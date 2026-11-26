import { type DataParser, FirmwareKind, getWasm, type LogHeaders, Parser, ParserEventKind } from 'blackbox-log';

import { MAX_PARSER_DEBUG_MODE } from '../constants';
import type {
  Axis3,
  Axis4,
  DataPresence,
  GpsFrameSeries,
  ParsedLog,
  ProgressCallback,
  SetupInfo,
  SlowFrameSeries,
} from '../types';
import { rawGyroSource } from './rawGyroSource';
import { resolveDebugMode } from './resolveDebugMode';
import { parserState } from './state';

function getParser(): Promise<Parser> {
  if (!parserState.parser) {
    parserState.parser = Parser.init(getWasm());
  }

  return parserState.parser;
}

/** Per-axis index. */
const ROLL = 0;

const PITCH = 1;

const YAW = 2;

const THROTTLE = 3;

/**
 * Parse a single log (logIndex) out of a Betaflight/INAV blackbox file.
 * Materializes main-frame fields into Float32Array columns matching the conventional BB-log column layout.
 */
export async function parseLog(
  file: File,
  options: { logIndex?: number; onProgress?: ProgressCallback } = {},
): Promise<ParsedLog> {
  const { logIndex = 0, onProgress } = options;
  const rawBuffer = await file.arrayBuffer();

  // The deprecated blackbox-log Rust parser rejects year-based or prerelease
  // version strings (e.g. "2026.6.0-alpha") and debug modes newer than BF 4.4.
  // Patch both headers while preserving byte length; stash the real values for
  // display.
  const { patched, originalFirmwareLine, originalDebugMode } = patchHeaders(new Uint8Array(rawBuffer));

  const parser = await getParser();
  const logFile = parser.loadFile(patched);
  const logCount = logFile.logCount;

  if (logIndex >= logCount) {
    throw new Error(`Log index ${logIndex} out of range (file has ${logCount} log(s))`);
  }

  const headers = logFile.parseHeaders(logIndex);

  if (!headers) {
    throw new Error(`Failed to parse headers for log ${logIndex} of ${file.name}`);
  }

  const dataParser = headers.getDataParser();
  const frames = collectFrames(dataParser, onProgress);
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

  const setup = extractSetup(headers, timeArr, originalFirmwareLine, originalDebugMode);

  // Collect motors: motor[0], motor[1], ... until missing.
  const motor = indexedColumns(cols, 'motor', rowCount);
  // eRPM telemetry, one channel per motor (from BiDirectional DSHOT). May be absent.
  const eRpm = indexedColumns(cols, 'eRPM', rowCount);

  const slow = slowSeries(frames, timeArr, t0);
  const gps = gpsSeries(frames, t0);

  // Track which optional fields were actually present in the source log.
  // For PID, only consider it "present" if at least one axis was logged — the
  // parser zero-fills missing columns, so a key check tells us whether the
  // source contained the data at all.
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

  const result: ParsedLog = {
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
    presence,
  };

  dataParser.free();
  headers.free();
  logFile.free();
  return result;
}

/** Everything read from the data frames, before conversion to typed columns. */
interface FrameBuffers {
  // Growing column buffers — push into JS arrays, convert to Float32Array at end.
  time: number[];
  cols: Map<string, number[]>;
  rowCount: number;
  lastProgressEmit: number;
  // Slow + GPS frames are interleaved. Slow frames have no `time` field of
  // their own, so we associate each one with the most recent main-frame time.
  slowTime: number[];
  slowVbat: number[];
  slowAmperage: number[];
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

type FrameFields = ReadonlyMap<string, number>;

/** Read every main, slow and GPS frame, reporting progress along the way. */
function collectFrames(dataParser: DataParser, onProgress: ProgressCallback | undefined): FrameBuffers {
  const buf: FrameBuffers = {
    time: [],
    cols: new Map<string, number[]>(),
    rowCount: 0,
    lastProgressEmit: 0,
    slowTime: [],
    slowVbat: [],
    slowAmperage: [],
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

  for (const event of dataParser) {
    if (event.kind === ParserEventKind.MainFrame) {
      addMainFrame(buf, event.data.time, event.data.fields);
      if (onProgress && buf.rowCount % 4096 === 0) emitProgress(buf, dataParser, onProgress);
    } else if (event.kind === ParserEventKind.SlowFrame) {
      addSlowFrame(buf, event.data.fields);
    } else if (event.kind === ParserEventKind.GpsFrame) {
      addGpsFrame(buf, event.data.time, event.data.fields);
    }
  }

  if (onProgress) onProgress({ progress: 1, rows: buf.rowCount });

  return buf;
}

function addMainFrame(buf: FrameBuffers, time: number, fields: FrameFields): void {
  buf.time.push(time);
  buf.lastMainTime = time;

  for (const [name, value] of fields) {
    let arr = buf.cols.get(name);

    if (!arr) {
      arr = [];
      buf.cols.set(name, arr);
    }

    arr.push(value);
  }

  buf.rowCount++;
}

/** Report progress at most every 100 ms. */
function emitProgress(buf: FrameBuffers, dataParser: DataParser, onProgress: ProgressCallback): void {
  const now = performance.now();
  if (!(now - buf.lastProgressEmit > 100)) return;

  const stats = dataParser.stats();
  onProgress({ progress: stats.progress, rows: buf.rowCount });
  buf.lastProgressEmit = now;
}

function addSlowFrame(buf: FrameBuffers, f: FrameFields): void {
  buf.slowTime.push(buf.lastMainTime);
  if (pushOrNaN(buf.slowVbat, f.get('vbatLatest'))) buf.sawSlowVbat = true;
  if (pushOrNaN(buf.slowAmperage, f.get('amperageLatest'))) buf.sawSlowAmperage = true;
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

function addGpsFrame(buf: FrameBuffers, time: number, f: FrameFields): void {
  buf.gpsTime.push(time);
  buf.gpsLat.push(gpsCoordDegrees(f.get('GPS_coord[0]') ?? NaN, 'lat'));
  buf.gpsLon.push(gpsCoordDegrees(f.get('GPS_coord[1]') ?? NaN, 'lon'));
  buf.gpsAlt.push(f.get('GPS_altitude') ?? NaN);
  buf.gpsSpeed.push(f.get('GPS_speed') ?? NaN);
  buf.gpsNumSat.push(f.get('GPS_numSat') ?? NaN);
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
 * Build the GPS series. Apply blackbox-log's natural units conversion:
 * GPS altitude/speed: blackbox-log often surfaces raw ints; coerce to SI for the UI:
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

function extractSetup(
  headers: LogHeaders,
  time: Float32Array,
  originalFirmwareLine: string | null,
  originalDebugMode: number | null,
): SetupInfo {
  const dtMedian = medianStride(time);
  const sampleRateHz = dtMedian > 0 ? Math.round(1 / dtMedian) : 0;
  const looptimeUs = dtMedian > 0 ? Math.round(dtMedian * 1_000_000) : 0;

  const firmwareKind: string = headers.firmwareKind === FirmwareKind.Inav ? 'INAV' : 'Betaflight';
  const rawLine = originalFirmwareLine ?? headers.firmwareVersion.toString();
  const firmwareVersion = rawLine.replace(/^(Betaflight|INAV|EmuFlight)\s+/i, '');
  const firmwareMajor = Number.parseInt(firmwareVersion, 10);
  const craftName = headers.craftName;

  const rawHeaders: Record<string, string> = {};
  for (const [key, value] of headers.unknown) rawHeaders[key] = value;

  const features: string[] = [];
  for (const f of headers.features) features.push(f);

  return {
    firmwareKind,
    firmwareVersion,
    craftName,
    boardInfo: headers.boardInfo,
    debugMode: resolveDebugMode(
      originalDebugMode,
      headers.debugMode,
      firmwareKind,
      Number.isNaN(firmwareMajor) ? 0 : firmwareMajor,
    ),
    pwmProtocol: headers.pwmProtocol,
    looptimeUs,
    sampleRateHz,
    rawHeaders,
    features,
  };
}

interface HeaderPatchResult {
  patched: Uint8Array;
  /** The full firmware revision string read from the original buffer, e.g. "Betaflight 2026.6.0-alpha (norevision) STM32F405". Null if no header was found. */
  originalFirmwareLine: string | null;
  /** The `debug_mode` value read from the original buffer. Null if absent or non-numeric. */
  originalDebugMode: number | null;
}

/** Apply every in-place header rewrite the bundled parser needs. */
function patchHeaders(input: Uint8Array): HeaderPatchResult {
  const { patched: fwPatched, originalFirmwareLine } = patchFirmwareVersion(input);
  const { patched, originalDebugMode } = patchDebugMode(fwPatched);
  return { patched, originalFirmwareLine, originalDebugMode };
}

const FIRMWARE_HEADER_PREFIX = 'H Firmware revision:';

const DEBUG_MODE_HEADER_PREFIX = 'H debug_mode:';

const HEADER_SCAN_BYTES = 16_384;

// The bundled blackbox-log Rust crate (v0.3.1, pinned by blackbox-log-ts 0.2.2)
// accepts Betaflight [4.2.0, 4.5.0) and INAV [5.0.0, 5.2.0) ∪ [6.0.0, 6.1.0).
// 4.4.0 is well inside the BF range. For INAV logs we'd need 5.1.x or 6.0.x.
const PARSER_FRIENDLY_VERSION = '4.4.0';

/**
 * Rewrite the firmware version inside the header so the deprecated blackbox-log
 * parser will accept it. We only touch the version token; the rest of the line
 * (firmware name, board suffix, etc.) is left alone. Length is preserved so all
 * downstream byte offsets remain valid.
 */
function patchFirmwareVersion(input: Uint8Array): { patched: Uint8Array; originalFirmwareLine: string | null } {
  const scanLen = Math.min(input.byteLength, HEADER_SCAN_BYTES);
  const decoder = new TextDecoder('latin1');
  const head = decoder.decode(input.subarray(0, scanLen));

  const prefixIdx = head.indexOf(FIRMWARE_HEADER_PREFIX);

  if (prefixIdx < 0) {
    return { patched: input, originalFirmwareLine: null };
  }

  const lineStart = prefixIdx + FIRMWARE_HEADER_PREFIX.length;
  const lineEnd = head.indexOf('\n', lineStart);
  if (lineEnd < 0) return { patched: input, originalFirmwareLine: null };

  const fullLine = head.slice(lineStart, lineEnd).replace(/\r$/, '');

  // Inside the line, find the first version-shaped token: digits.dots[.-alpha…].
  // Example: "Betaflight 2026.6.0-alpha (norevision) STM32F405"
  const versionMatch = /(\d+(?:\.\d+){1,3})(-[\w.]+)?/.exec(fullLine);

  if (!versionMatch) {
    return { patched: input, originalFirmwareLine: fullLine };
  }

  const versionToken = versionMatch[0]!; // e.g. "2026.6.0-alpha"
  const numericParts = versionMatch[1]!.split('.').map((s) => Number.parseInt(s, 10));
  const major = numericParts[0] ?? 0;
  const minor = numericParts[1] ?? 0;
  const hasPrerelease = versionMatch[2] !== undefined;

  // If the version is inside one of the bundled parser's accepted ranges, leave it alone.
  // Anything else — year-based majors, prereleases, or just newer-than-supported — gets
  // rewritten to PARSER_FRIENDLY_VERSION so the parser will accept the file.
  if (!hasPrerelease && isSupportedVersion(fullLine, major, minor)) {
    return { patched: input, originalFirmwareLine: fullLine };
  }

  const replacement = PARSER_FRIENDLY_VERSION.padEnd(versionToken.length, ' ');
  const tokenOffsetInLine = versionMatch.index;
  const byteOffset = lineStart + tokenOffsetInLine;

  const patched = new Uint8Array(input.byteLength);
  patched.set(input);
  const encoder = new TextEncoder();
  patched.set(encoder.encode(replacement), byteOffset);

  return { patched, originalFirmwareLine: fullLine };
}

/**
 * Blank out a `debug_mode` the bundled parser doesn't know about.
 *
 * The parser decodes this header against Betaflight 4.4's enum and throws
 * ("invalid value for header `debug_mode`: `97`") on anything past 78, which
 * takes down the whole log — even though the value is a label that has no
 * bearing on how frames are decoded. Newer firmware routinely exceeds 78:
 * `CHIRP` is 97 in BF 2025.12.
 *
 * So we rewrite the value to 0 (`NONE`) and hand the real number back for
 * display. Leading zeros keep the byte length identical ("97" → "00"); Rust's
 * integer parser accepts them, trailing spaces it would not.
 */
function patchDebugMode(input: Uint8Array): { patched: Uint8Array; originalDebugMode: number | null } {
  const scanLen = Math.min(input.byteLength, HEADER_SCAN_BYTES);
  const decoder = new TextDecoder('latin1');
  const head = decoder.decode(input.subarray(0, scanLen));

  // Anchor on the newline so we can't match `H gyro_debug_mode:`-style headers.
  const prefixIdx = head.indexOf(`\n${DEBUG_MODE_HEADER_PREFIX}`);
  if (prefixIdx < 0) return { patched: input, originalDebugMode: null };

  const valueStart = prefixIdx + 1 + DEBUG_MODE_HEADER_PREFIX.length;
  const lineEnd = head.indexOf('\n', valueStart);
  if (lineEnd < 0) return { patched: input, originalDebugMode: null };

  const rawValue = head.slice(valueStart, lineEnd).replace(/\r$/, '');
  if (!/^\d+$/.test(rawValue)) return { patched: input, originalDebugMode: null };
  const value = Number.parseInt(rawValue, 10);

  // In range — leave it alone so the parser names it for us.
  if (value <= MAX_PARSER_DEBUG_MODE) return { patched: input, originalDebugMode: value };

  const patched = new Uint8Array(input.byteLength);
  patched.set(input);
  const encoder = new TextEncoder();
  patched.set(encoder.encode('0'.repeat(rawValue.length)), valueStart);

  return { patched, originalDebugMode: value };
}

/**
 * Bundled blackbox-log Rust crate (v0.3.1) accepted ranges:
 *   Betaflight: [4.2.0, 4.5.0)
 *   INAV:       [5.0.0, 5.2.0) ∪ [6.0.0, 6.1.0)
 * Anything else needs patching even if the version string looks otherwise sane.
 */
function isSupportedVersion(firmwareLine: string, major: number, minor: number): boolean {
  if (/^INAV/i.test(firmwareLine)) {
    if (major === 5) return minor >= 0 && minor < 2;
    if (major === 6) return minor === 0;
    return false;
  }

  // Treat Betaflight/EmuFlight/Cleanflight derivatives the same way.
  return major === 4 && minor >= 2 && minor < 5;
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
