import { BlackboxDecoder } from '../blackbox/BlackboxDecoder';
import { findLogStarts } from '../blackbox/findLogStarts';
import { parseHeader } from '../blackbox/parseHeader';
import type {
  Axis3,
  Axis4,
  BbHeader,
  DataPresence,
  GpsFrameSeries,
  ParsedLog,
  ProgressCallback,
  SetupInfo,
  SlowFrameSeries,
} from '../types';
import { armEvents } from './armEvents';
import { debugModeName } from './debugModeName';
import { featureNames } from './featureNames';
import { firmwareInfo } from './firmwareInfo';
import { motorProtocolName } from './motorProtocolName';
import { rawGyroSource } from './rawGyroSource';

/** Per-axis index. */
const ROLL = 0;

const PITCH = 1;

const YAW = 2;

const THROTTLE = 3;

/** Index of the time field (µs) in main frames. */
const TIME = 1;

/** Progress is reported at most this often (ms). */
const PROGRESS_INTERVAL_MS = 100;

/**
 * Parse a single log (logIndex) out of a blackbox file. Materializes main-frame fields into
 * Float32Array columns matching the conventional BB-log column layout.
 */
export async function parseLog(
  file: File,
  options: { logIndex?: number; onProgress?: ProgressCallback } = {},
): Promise<ParsedLog> {
  const { logIndex = 0, onProgress } = options;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const starts = findLogStarts(bytes);
  const logCount = starts.length;

  if (logCount === 0) throw new Error(`${file.name} doesn't contain a blackbox log`);
  if (logIndex >= logCount) throw new Error(`Log index ${logIndex} out of range (file has ${logCount} log(s))`);

  const end = starts[logIndex + 1] ?? bytes.length;
  const header = parseHeader(bytes, starts[logIndex]!, end);
  const frames = collectFrames(bytes, header, end, onProgress);
  const { cols, rowCount } = frames;

  // Normalize time to start at 0.
  const t0 = frames.time[0] ?? 0;
  const timeArr = offsetFrom(frames.time, t0);

  // Helper to pull a triplet `name[0]`, `name[1]`, `name[2]` or fall back to zeros.
  const triplet = (base: string): Axis3 => [
    toF32(cols.get(`${base}[${ROLL}]`), rowCount),
    toF32(cols.get(`${base}[${PITCH}]`), rowCount),
    toF32(cols.get(`${base}[${YAW}]`), rowCount),
  ];
  const quad = (base: string): Axis4 => [
    toF32(cols.get(`${base}[0]`), rowCount),
    toF32(cols.get(`${base}[1]`), rowCount),
    toF32(cols.get(`${base}[2]`), rowCount),
    toF32(cols.get(`${base}[${THROTTLE}]`), rowCount),
  ];

  // Setpoint: newer firmwares emit `setpoint[..]`, older emit `rcCommands[..]`.
  const setpointPrefix = cols.has('setpoint[0]') ? 'setpoint' : 'rcCommands';
  const setup = extractSetup(header.lines, timeArr);

  // Collect motors: motor[0], motor[1], ... until missing.
  const motor = indexedColumns(cols, 'motor', rowCount);
  // eRPM telemetry, one channel per motor (from BiDirectional DSHOT). May be absent.
  const eRpm = indexedColumns(cols, 'eRPM', rowCount);

  const slow = slowSeries(frames, timeArr, t0);
  const gps = gpsSeries(frames, t0);

  // Track which optional fields were actually present in the source log.
  const rawSource = rawGyroSource(cols.has('gyroUnfilt[0]'), cols.has('debug[0]'), setup.debugMode ?? '');
  const presence: DataPresence = {
    gyroRaw: rawSource != null,
    pidTerms: hasAnyPidTerm(cols),
    iTerm: cols.has('axisI[0]'),
    motors: motor.length > 0,
    eRpm: eRpm.length > 0,
    vbat: slow.vbat.length > 0,
    amperage: slow.amperage.length > 0,
    gps: frames.sawGps,
  };

  return {
    fileName: file.name,
    logIndex,
    logCount,
    setup,
    time: timeArr,
    gyroFilt: triplet('gyroADC'),
    gyroRaw: triplet(rawSource ?? 'gyroUnfilt'),
    pTerm: triplet('axisP'),
    iTerm: triplet('axisI'),
    dTerm: [toF32(cols.get('axisD[0]'), rowCount), toF32(cols.get('axisD[1]'), rowCount)] as const,
    fTerm: triplet('axisF'),
    setpoint: quad(setpointPrefix),
    rcCommand: quad('rcCommand'),
    motor,
    eRpm,
    debug: Array.from({ length: 8 }, (_, i) => `debug[${i}]`)
      .filter((c) => cols.has(c))
      .map((c) => toF32(cols.get(c), rowCount)),
    slow,
    gps,
    events: armEvents(offsetFrom(frames.slowTime, t0), frames.slowModeFlags),
    presence,
  };
}

/** Everything read from the data frames, before conversion to typed columns. Times in seconds. */
interface FrameBuffers {
  time: number[];
  cols: Map<string, number[]>;
  rowCount: number;
  // Slow + GPS frames are interleaved. Slow frames have no `time` field of
  // their own, so we associate each one with the most recent main-frame time.
  slowTime: number[];
  slowVbat: number[];
  slowAmperage: number[];
  slowModeFlags: number[];
  lastMainTime: number;
  sawSlowVbat: boolean;
  sawSlowAmperage: boolean;
  gpsTime: number[];
  gpsLat: number[];
  gpsLon: number[];
  gpsAlt: number[];
  gpsSpeed: number[];
  gpsNumSat: number[];
  sawGps: boolean;
}

function emptyBuffers(names: readonly string[]): FrameBuffers {
  return {
    time: [],
    cols: new Map(names.filter((n) => n !== 'time' && n !== 'loopIteration').map((n) => [n, []])),
    rowCount: 0,
    slowTime: [],
    slowVbat: [],
    slowAmperage: [],
    slowModeFlags: [],
    lastMainTime: 0,
    sawSlowVbat: false,
    sawSlowAmperage: false,
    gpsTime: [],
    gpsLat: [],
    gpsLon: [],
    gpsAlt: [],
    gpsSpeed: [],
    gpsNumSat: [],
    sawGps: false,
  };
}

/** A reader for one named field of a frame: its value, or undefined when the frame type lacks it. */
function fieldReader(names: readonly string[] | undefined, name: string) {
  const i = names?.indexOf(name) ?? -1;

  return (v: readonly number[]) => (i >= 0 ? v[i] : undefined);
}

/** Read every main, slow and GPS frame, reporting progress along the way. */
function collectFrames(
  bytes: Uint8Array,
  header: BbHeader,
  end: number,
  onProgress: ProgressCallback | undefined,
): FrameBuffers {
  const names = header.frameDefs.I?.names ?? [];
  const buf = emptyBuffers(names);
  const columns = names.map((n) => buf.cols.get(n));
  const { S, G } = header.frameDefs;
  const slow = {
    vbat: fieldReader(S?.names, 'vbatLatest'),
    amps: fieldReader(S?.names, 'amperageLatest'),
    flags: fieldReader(S?.names, 'flightModeFlags'),
  };
  const gps = gpsFields(G?.names);
  let lastEmit = 0;

  new BlackboxDecoder(bytes, header, end).run({
    main: (v) => {
      const t = v[TIME]! / 1e6;
      buf.time.push(t);
      buf.lastMainTime = t;
      for (let i = 0; i < columns.length; i++) columns[i]?.push(v[i]!);
      buf.rowCount++;
    },
    slow: (v) => {
      buf.slowTime.push(buf.lastMainTime);
      if (pushOrNaN(buf.slowVbat, slow.vbat(v))) buf.sawSlowVbat = true;
      if (pushOrNaN(buf.slowAmperage, slow.amps(v))) buf.sawSlowAmperage = true;
      pushOrNaN(buf.slowModeFlags, slow.flags(v));
    },
    gps: (v) => addGpsFrame(buf, v, gps),
    progress: (share) => {
      const now = performance.now();
      if (!onProgress || now - lastEmit < PROGRESS_INTERVAL_MS) return;
      lastEmit = now;
      onProgress({ progress: share, rows: buf.rowCount });
    },
  });

  onProgress?.({ progress: 1, rows: buf.rowCount });

  return buf;
}

function gpsFields(names: readonly string[] | undefined) {
  return {
    time: fieldReader(names, 'time'),
    lat: fieldReader(names, 'GPS_coord[0]'),
    lon: fieldReader(names, 'GPS_coord[1]'),
    alt: fieldReader(names, 'GPS_altitude'),
    speed: fieldReader(names, 'GPS_speed'),
    numSat: fieldReader(names, 'GPS_numSat'),
  };
}

/** Push the value, or NaN when the field is missing; true when it was present. */
function pushOrNaN(target: number[], value: number | undefined): boolean {
  if (value === undefined) {
    target.push(NaN);
    return false;
  }

  target.push(value);
  return true;
}

function addGpsFrame(buf: FrameBuffers, v: readonly number[], f: ReturnType<typeof gpsFields>): void {
  const time = f.time(v);
  buf.gpsTime.push(time === undefined ? buf.lastMainTime : time / 1e6);
  buf.gpsLat.push(gpsCoordDegrees(f.lat(v) ?? NaN, 'lat'));
  buf.gpsLon.push(gpsCoordDegrees(f.lon(v) ?? NaN, 'lon'));
  buf.gpsAlt.push(f.alt(v) ?? NaN);
  buf.gpsSpeed.push(f.speed(v) ?? NaN);
  buf.gpsNumSat.push(f.numSat(v) ?? NaN);
  buf.sawGps = true;
}

/** Times relative to t0, as Float32. */
function offsetFrom(times: number[], t0: number): Float32Array {
  const out = new Float32Array(times.length);
  for (let i = 0; i < times.length; i++) out[i] = times[i]! - t0;
  return out;
}

/** Columns `name[0]`, `name[1]`, ... until the first missing one. */
function indexedColumns(cols: Map<string, number[]>, name: string, rowCount: number): Float32Array[] {
  const out: Float32Array[] = [];

  for (let i = 0; ; i++) {
    const col = cols.get(`${name}[${i}]`);
    if (!col) break;
    out.push(toF32(col, rowCount));
  }

  return out;
}

/** Battery from slow frames, or from main frames when only those carry it. */
function slowSeries(frames: FrameBuffers, timeArr: Float32Array, t0: number): SlowFrameSeries {
  const { cols, sawSlowVbat, sawSlowAmperage } = frames;
  // Normalize slow frame times to the same t0.
  const slowTimeArr = offsetFrom(frames.slowTime, t0);

  if (!sawSlowVbat && !sawSlowAmperage && (cols.has('vbatLatest') || cols.has('amperageLatest'))) {
    return batteryFromMainFrames(timeArr, cols.get('vbatLatest'), cols.get('amperageLatest'));
  }

  return {
    time: slowTimeArr,
    vbat: sawSlowVbat ? floatsFromNums(frames.slowVbat) : new Float32Array(),
    amperage: sawSlowAmperage ? floatsFromNums(frames.slowAmperage) : new Float32Array(),
  };
}

/**
 * Build the GPS series. GPS altitude and speed are raw integers whose units vary;
 * coerce them to SI for the UI:
 *   altitude → meters (cm/decimeters/int meters vary by FW / receiver),
 *   speed → m/s (Betaflight frequently logs cm/s).
 */
function gpsSeries(frames: FrameBuffers, t0: number): GpsFrameSeries {
  // Normalize GPS frame times to the same t0.
  const gpsTimeArr = offsetFrom(frames.gpsTime, t0);
  const gpsAltMul = gpsAltitudeMetersMultiplier(frames.gpsAlt);
  const gpsSpdMul = gpsSpeedMpsMultiplier(frames.gpsSpeed);
  if (!frames.sawGps) return emptyGps();

  return {
    time: gpsTimeArr,
    lat: floatsFromNums(frames.gpsLat),
    lon: floatsFromNums(frames.gpsLon),
    altitude: scaledFloat32FromNums(frames.gpsAlt, gpsAltMul),
    speed: scaledFloat32FromNums(frames.gpsSpeed, gpsSpdMul),
    numSat: floatsFromNums(frames.gpsNumSat),
  };
}

function hasAnyPidTerm(cols: Map<string, number[]>): boolean {
  return cols.has('axisP[0]') || cols.has('axisI[0]') || cols.has('axisD[0]') || cols.has('axisF[0]');
}

function floatsFromNums(xs: number[]): Float32Array {
  const out = new Float32Array(xs.length);
  for (let i = 0; i < xs.length; i++) out[i] = xs[i]!;
  return out;
}

function scaledFloat32FromNums(xs: number[], multiplier: number): Float32Array {
  const out = new Float32Array(xs.length);

  for (let i = 0; i < xs.length; i++) {
    const x = xs[i]!;
    out[i] = Number.isFinite(x) ? x * multiplier : NaN;
  }

  return out;
}

/**
 * Betaflight often logs GPS ground speed as **cm/s**; values ≫100 imply that encoding.
 */
function gpsSpeedMpsMultiplier(speeds: number[]): number {
  let mx = 0;

  for (let i = 0; i < speeds.length; i++) {
    const x = speeds[i]!;
    if (!Number.isFinite(x)) continue;
    const ax = Math.abs(x);
    if (ax > mx) mx = ax;
  }

  return mx > 130 ? 0.01 : 1;
}

function gpsAltitudeMetersMultiplier(alts: number[]): number {
  const raw = alts.filter((x) => Number.isFinite(x));
  if (raw.length === 0) return 1;
  const mxRaw = raw.reduce((a, x) => Math.max(a, Math.abs(x)), 0);

  let bestMul = 1;
  let best = Infinity;

  const tryMul = (m: number) => {
    const c = altitudeScaleCost(raw, mxRaw, m);

    if (c != null && c < best) {
      best = c;
      bestMul = m;
    }
  };

  tryMul(0.01);
  tryMul(0.1);
  tryMul(1);

  if (best !== Infinity) return bestMul;
  return mxRaw >= 45_000 ? 0.01 : mxRaw >= 9200 ? 0.1 : 1;
}

interface ScaledAltitudes {
  mxScaled: number;
  sum: number;
  med: number;
  minV: number;
  maxV: number;
  count: number;
}

/** Lower cost is better — reject impossible Earth-surface ranges. */
function altitudeScaleCost(raw: number[], mxRaw: number, mul: number): number | null {
  const scaled = scaleAltitudes(raw, mul);
  if (!Number.isFinite(scaled.med)) return null;
  if (!plausibleAltitudes(scaled)) return null;

  const meanAbs = scaled.sum / scaled.count;

  const c = rawMagnitudePenalty(scaled.mxScaled + meanAbs * 0.06, mxRaw, mul, scaled);

  return medianPreference(c, scaled);
}

function rawMagnitudePenalty(base: number, mxRaw: number, mul: number, { mxScaled, med }: ScaledAltitudes): number {
  let c = base;

  if (mxRaw >= 8200 && mul === 1) c += 35_000;
  // Over-shrunk altitude (/cm) when magnitude clearly large in raw ints.
  if (mxRaw > 7800 && mul === 0.01 && mxScaled < 180) c += 12_500;
  if (mxRaw > 7800 && mul === 0.01 && med < 180) c += 9000;

  return c;
}

/** Mild preference for middling AMSL / AGL-ish medians vs sea-level artefacts. */
function medianPreference(base: number, { mxScaled, med }: ScaledAltitudes): number {
  let c = base;
  if (med > 260 && med < 6500 && mxScaled < 8500) c -= med > 520 ? 40 : 0;

  return c;
}

function scaleAltitudes(raw: number[], mul: number): ScaledAltitudes {
  let mxScaled = 0;
  let sum = 0;
  const scaledArr: number[] = [];

  for (let i = 0; i < raw.length; i++) {
    const v = raw[i]! * mul;
    scaledArr.push(v);
    const ax = Math.abs(v);
    if (ax > mxScaled) mxScaled = ax;
    sum += Math.abs(v);
  }

  scaledArr.sort((x, y) => x - y);
  const med = scaledArr.length ? scaledArr[Math.floor(scaledArr.length / 2)]! : NaN;

  return {
    mxScaled,
    sum,
    med,
    minV: scaledArr[0]!,
    maxV: scaledArr[scaledArr.length - 1]!,
    count: scaledArr.length,
  };
}

function plausibleAltitudes({ mxScaled, med, minV, maxV }: ScaledAltitudes): boolean {
  if (mxScaled > 9800 || med < -800 || med > 12_000) return false;
  return !(maxV > 9800 || minV < -1200);
}

/** Integer lat/lon in blackbox are degrees × 1e7; normalize when clearly not decimal degrees. */
function gpsCoordDegrees(raw: number, axis: 'lat' | 'lon'): number {
  if (!Number.isFinite(raw)) return raw;
  const limit = axis === 'lat' ? 90 : 180;
  if (Math.abs(raw) <= limit) return raw;
  return raw / 1e7;
}

function emptyGps(): GpsFrameSeries {
  return {
    time: new Float32Array(),
    lat: new Float32Array(),
    lon: new Float32Array(),
    altitude: new Float32Array(),
    speed: new Float32Array(),
    numSat: new Float32Array(),
  };
}

function toF32(src: number[] | undefined, length: number): Float32Array {
  const out = new Float32Array(length);
  if (!src) return out;
  const n = Math.min(src.length, length);
  for (let i = 0; i < n; i++) out[i] = src[i]!;
  return out;
}

/** Every header line except the field definitions, as a record. */
function headerRecord(lines: ReadonlyMap<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of lines) if (!key.startsWith('Field ')) out[key] = value;

  return out;
}

function extractSetup(lines: ReadonlyMap<string, string>, time: Float32Array): SetupInfo {
  const dtMedian = medianStride(time);
  const fw = firmwareInfo(lines);

  const num = (key: string) => {
    const v = Number.parseInt(lines.get(key) ?? '', 10);

    return Number.isFinite(v) ? v : null;
  };

  return {
    firmwareKind: fw.kind,
    firmwareVersion: fw.version,
    craftName: lines.get('Craft name') || undefined,
    boardInfo: lines.get('Board information') || undefined,
    debugMode: debugModeName(num('debug_mode'), fw),
    pwmProtocol: motorProtocolName(num('motor_pwm_protocol')),
    looptimeUs: dtMedian > 0 ? Math.round(dtMedian * 1_000_000) : 0,
    sampleRateHz: dtMedian > 0 ? Math.round(1 / dtMedian) : 0,
    rawHeaders: headerRecord(lines),
    features: featureNames(num('features') ?? 0),
  };
}

/** Median of consecutive differences — robust against gaps. */
function medianStride(time: Float32Array): number {
  if (time.length < 2) return 0;
  // Sample at most 1000 strides spaced through the log for speed.
  const N = time.length - 1;
  const stride = Math.max(1, Math.floor(N / 1000));
  const samples: number[] = [];
  for (let i = 0; i < N; i += stride) samples.push(time[i + 1]! - time[i]!);
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)] ?? 0;
}

/** Battery samples per second kept when voltage and current come from main frames. */
const MAIN_FRAME_BATTERY_HZ = 10;

/**
 * Betaflight 4.x logs vbatLatest and amperageLatest in every main frame rather
 * than in slow frames, in 0.01 V and 0.01 A. Thin them to about 10 Hz and
 * convert to volts and amps so battery analyses see the same data either way.
 */
function batteryFromMainFrames(
  time: Float32Array,
  vbat: number[] | undefined,
  amperage: number[] | undefined,
): SlowFrameSeries {
  const n = time.length;
  const span = n > 1 ? time[n - 1]! - time[0]! : 0;
  const step = span > 0 ? Math.max(1, Math.round(n / (span * MAIN_FRAME_BATTERY_HZ))) : 1;
  const idx: number[] = [];
  for (let i = 0; i < n; i += step) idx.push(i);

  return {
    time: Float32Array.from(idx, (i) => time[i]!),
    vbat: vbat ? Float32Array.from(idx, (i) => (vbat[i] ?? Number.NaN) / 100) : new Float32Array(),
    amperage: amperage ? Float32Array.from(idx, (i) => (amperage[i] ?? Number.NaN) / 100) : new Float32Array(),
  };
}
