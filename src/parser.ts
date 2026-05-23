import { Parser, ParserEventKind, getWasm, FirmwareKind, type LogHeaders } from 'blackbox-log';
import type { Axis3, Axis4, DataPresence, GpsFrameSeries, ParsedLog, SetupInfo, SlowFrameSeries } from './types';

let parserPromise: Promise<Parser> | null = null;

function getParser(): Promise<Parser> {
  if (!parserPromise) {
    parserPromise = Parser.init(getWasm());
  }
  return parserPromise;
}

/** Per-axis index. */
const ROLL = 0;
const PITCH = 1;
const YAW = 2;
const THROTTLE = 3;

interface ParseProgress {
  progress: number;
  rows: number;
}

export type ProgressCallback = (p: ParseProgress) => void;

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
  // version strings (e.g. "2026.6.0-alpha"). Patch the firmware revision header
  // to a parser-friendly version while preserving byte length; stash the real
  // version for display.
  const { patched, originalFirmwareLine } = patchFirmwareVersion(new Uint8Array(rawBuffer));

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

  // Growing column buffers — push into JS arrays, convert to Float32Array at end.
  const time: number[] = [];
  const cols = new Map<string, number[]>();

  const ensure = (name: string): number[] => {
    let arr = cols.get(name);
    if (!arr) {
      arr = [];
      cols.set(name, arr);
    }
    return arr;
  };

  let lastProgressEmit = 0;
  let rowCount = 0;

  // Slow + GPS frames are interleaved. Slow frames have no `time` field of
  // their own, so we associate each one with the most recent main-frame time.
  const slowTime: number[] = [];
  const slowVbat: number[] = [];
  const slowAmperage: number[] = [];
  let lastMainTime = 0;
  let sawSlowVbat = false;
  let sawSlowAmperage = false;

  const gpsTime: number[] = [];
  const gpsLat: number[] = [];
  const gpsLon: number[] = [];
  const gpsAlt: number[] = [];
  const gpsSpeed: number[] = [];
  const gpsNumSat: number[] = [];
  let sawGps = false;

  for (const event of dataParser) {
    if (event.kind === ParserEventKind.MainFrame) {
      const frame = event.data;
      time.push(frame.time);
      lastMainTime = frame.time;
      for (const [name, value] of frame.fields) {
        ensure(name).push(value);
      }
      rowCount++;

      if (onProgress && rowCount % 4096 === 0) {
        const now = performance.now();
        if (now - lastProgressEmit > 100) {
          const stats = dataParser.stats();
          onProgress({ progress: stats.progress, rows: rowCount });
          lastProgressEmit = now;
        }
      }
    } else if (event.kind === ParserEventKind.SlowFrame) {
      const f = event.data.fields;
      slowTime.push(lastMainTime);
      const vb = f.get('vbatLatest');
      if (vb !== undefined) { slowVbat.push(vb); sawSlowVbat = true; }
      else slowVbat.push(NaN);
      const am = f.get('amperageLatest');
      if (am !== undefined) { slowAmperage.push(am); sawSlowAmperage = true; }
      else slowAmperage.push(NaN);
    } else if (event.kind === ParserEventKind.GpsFrame) {
      const f = event.data.fields;
      gpsTime.push(event.data.time);
      gpsLat.push(gpsCoordDegrees(f.get('GPS_coord[0]') ?? NaN, 'lat'));
      gpsLon.push(gpsCoordDegrees(f.get('GPS_coord[1]') ?? NaN, 'lon'));
      gpsAlt.push(f.get('GPS_altitude') ?? NaN);
      gpsSpeed.push(f.get('GPS_speed') ?? NaN);
      gpsNumSat.push(f.get('GPS_numSat') ?? NaN);
      sawGps = true;
    }
  }

  if (onProgress) onProgress({ progress: 1, rows: rowCount });

  // Normalize time to start at 0.
  const t0 = time[0] ?? 0;
  const timeArr = new Float32Array(time.length);
  for (let i = 0; i < time.length; i++) timeArr[i] = time[i]! - t0;

  // Normalize slow + GPS frame times to the same t0.
  const slowTimeArr = new Float32Array(slowTime.length);
  for (let i = 0; i < slowTime.length; i++) slowTimeArr[i] = slowTime[i]! - t0;
  const gpsTimeArr = new Float32Array(gpsTime.length);
  for (let i = 0; i < gpsTime.length; i++) gpsTimeArr[i] = gpsTime[i]! - t0;

  const gpsAltMul = gpsAltitudeMetersMultiplier(gpsAlt);
  const gpsSpdMul = gpsSpeedMpsMultiplier(gpsSpeed);

  // Helper to pull a triplet `name[0]`, `name[1]`, `name[2]` or fall back to zeros.
  const triplet = (base: string): Axis3 => [
    toF32(cols.get(`${base}[${ROLL}]`), rowCount),
    toF32(cols.get(`${base}[${PITCH}]`), rowCount),
    toF32(cols.get(`${base}[${YAW}]`), rowCount),
  ];
  /** Try each base in order; use the first one whose roll column exists. */
  const tripletWithFallback = (...bases: string[]): Axis3 => {
    for (const base of bases) {
      if (cols.has(`${base}[0]`)) return triplet(base);
    }
    return triplet(bases[0]!);
  };
  const quad = (base: string): Axis4 => [
    toF32(cols.get(`${base}[0]`), rowCount),
    toF32(cols.get(`${base}[1]`), rowCount),
    toF32(cols.get(`${base}[2]`), rowCount),
    toF32(cols.get(`${base}[${THROTTLE}]`), rowCount),
  ];

  // Setpoint: newer firmwares emit `setpoint[..]`, older emit `rcCommands[..]`.
  const setpointPrefix = cols.has('setpoint[0]') ? 'setpoint' : 'rcCommands';

  const setup = extractSetup(headers, timeArr, originalFirmwareLine);

  // Collect motors: motor[0], motor[1], ... until missing.
  const motor: Float32Array[] = [];
  for (let i = 0; ; i++) {
    const col = cols.get(`motor[${i}]`);
    if (!col) break;
    motor.push(toF32(col, rowCount));
  }

  // eRPM telemetry, one channel per motor (from BiDirectional DSHOT). May be absent.
  const eRpm: Float32Array[] = [];
  for (let i = 0; ; i++) {
    const col = cols.get(`eRPM[${i}]`);
    if (!col) break;
    eRpm.push(toF32(col, rowCount));
  }

  // Build slow/gps series. Apply blackbox-log's natural units conversion:
  // GPS altitude/speed: blackbox-log often surfaces raw ints; coerce to SI for the UI:
  //   altitude → meters (cm/decimeters/int meters vary by FW / receiver),
  //   speed → m/s (Betaflight frequently logs cm/s).
  const slow: SlowFrameSeries = {
    time: slowTimeArr,
    vbat: sawSlowVbat ? floatsFromNums(slowVbat) : new Float32Array(),
    amperage: sawSlowAmperage ? floatsFromNums(slowAmperage) : new Float32Array(),
  };
  const gps: GpsFrameSeries = sawGps
    ? {
        time: gpsTimeArr,
        lat: floatsFromNums(gpsLat),
        lon: floatsFromNums(gpsLon),
        altitude: scaledFloat32FromNums(gpsAlt, gpsAltMul),
        speed: scaledFloat32FromNums(gpsSpeed, gpsSpdMul),
        numSat: floatsFromNums(gpsNumSat),
      }
    : emptyGps();

  // Track which optional fields were actually present in the source log.
  // For PID, only consider it "present" if at least one axis was logged — the
  // parser zero-fills missing columns, so a key check tells us whether the
  // source contained the data at all.
  const presence: DataPresence = {
    gyroRaw: cols.has('gyroUnfilt[0]') || cols.has('debug[0]'),
    pidTerms:
      cols.has('axisP[0]') ||
      cols.has('axisI[0]') ||
      cols.has('axisD[0]') ||
      cols.has('axisF[0]'),
    iTerm: cols.has('axisI[0]'),
    motors: motor.length > 0,
    eRpm: eRpm.length > 0,
    vbat: sawSlowVbat,
    amperage: sawSlowAmperage,
    gps: sawGps,
  };

  const result: ParsedLog = {
    fileName: file.name,
    logIndex,
    logCount,
    setup,
    time: timeArr,
    gyroFilt: triplet('gyroADC'),
    gyroRaw: tripletWithFallback('gyroUnfilt', 'debug'),
    pTerm: triplet('axisP'),
    iTerm: triplet('axisI'),
    dTerm: [
      toF32(cols.get('axisD[0]'), rowCount),
      toF32(cols.get('axisD[1]'), rowCount),
    ] as const,
    fTerm: triplet('axisF'),
    setpoint: quad(setpointPrefix),
    rcCommand: quad('rcCommand'),
    motor,
    eRpm,
    slow,
    gps,
    presence,
  };

  dataParser.free();
  headers.free();
  logFile.free();
  return result;
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

  /** Lower cost is better — reject impossible Earth-surface ranges. */
  function costWithMul(mul: number): number | null {
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
    if (!Number.isFinite(med)) return null;
    const minV = scaledArr[0]!;
    const maxV = scaledArr[scaledArr.length - 1]!;

    if (mxScaled > 9800 || med < -800 || med > 12_000) return null;
    if (maxV > 9800 || minV < -1200) return null;

    const meanAbs = sum / scaledArr.length;
    let c = mxScaled + meanAbs * 0.06;

    if (mxRaw >= 8200 && mul === 1) c += 35_000;
    // Over-shrunk altitude (/cm) when magnitude clearly large in raw ints.
    if (mxRaw > 7800 && mul === 0.01 && mxScaled < 180) c += 12_500;
    if (mxRaw > 7800 && mul === 0.01 && med < 180) c += 9000;
    // Mild preference for middling AMSL / AGL-ish medians vs sea-level artefacts.
    if (med > 260 && med < 6500 && mxScaled < 8500) c -= (med > 520 ? 40 : 0);

    return c;
  }

  let bestMul = 1;
  let best = Infinity;

  const tryMul = (m: number) => {
    const c = costWithMul(m);
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
): SetupInfo {
  const dtMedian = medianStride(time);
  const sampleRateHz = dtMedian > 0 ? Math.round(1 / dtMedian) : 0;
  const looptimeUs = dtMedian > 0 ? Math.round(dtMedian * 1_000_000) : 0;

  const firmwareKind: string = headers.firmwareKind === FirmwareKind.Inav ? 'INAV' : 'Betaflight';
  const rawLine = originalFirmwareLine ?? headers.firmwareVersion.toString();
  const firmwareVersion = rawLine.replace(/^(Betaflight|INAV|EmuFlight)\s+/i, '');
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
    debugMode: headers.debugMode,
    pwmProtocol: headers.pwmProtocol,
    looptimeUs,
    sampleRateHz,
    rawHeaders,
    features,
  };
}

interface FirmwarePatchResult {
  patched: Uint8Array;
  /** The full firmware revision string read from the original buffer, e.g. "Betaflight 2026.6.0-alpha (norevision) STM32F405". Null if no header was found. */
  originalFirmwareLine: string | null;
}

const FIRMWARE_HEADER_PREFIX = 'H Firmware revision:';
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
function patchFirmwareVersion(input: Uint8Array): FirmwarePatchResult {
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
