import type { Axis3, Axis4, GpsFrameSeries, ParsedLog, SlowFrameSeries } from './types';

export interface TimeRangeSec {
  start: number;
  end: number;
}

/**
 * Return a new ParsedLog containing only the samples whose time falls within
 * [range.start, range.end]. All per-sample arrays are sliced; setup metadata
 * and motor count are preserved.
 *
 * The result's `time` array is *not* re-zeroed — it preserves the original
 * timestamps, so downstream plots show actual flight time rather than an
 * offset within the window.
 */
export function sliceLog(log: ParsedLog, range: TimeRangeSec): ParsedLog {
  const i0 = lowerBound(log.time, range.start);
  const i1 = upperBound(log.time, range.end);
  if (i0 >= i1) {
    return emptySlice(log);
  }
  const slice = (a: Float32Array) => a.slice(i0, i1);
  const triplet = (t: Axis3): Axis3 => [slice(t[0]), slice(t[1]), slice(t[2])] as const;
  const quad = (t: Axis4): Axis4 =>
    [slice(t[0]), slice(t[1]), slice(t[2]), slice(t[3])] as const;
  return {
    ...log,
    time: slice(log.time),
    gyroFilt: triplet(log.gyroFilt),
    gyroRaw: triplet(log.gyroRaw),
    pTerm: triplet(log.pTerm),
    iTerm: triplet(log.iTerm),
    dTerm: [slice(log.dTerm[0]), slice(log.dTerm[1])] as const,
    fTerm: triplet(log.fTerm),
    setpoint: quad(log.setpoint),
    rcCommand: quad(log.rcCommand),
    motor: log.motor.map(slice),
    eRpm: log.eRpm.map(slice),
    slow: sliceSlow(log.slow, range),
    gps: sliceGps(log.gps, range),
  };
}

function sliceSlow(slow: SlowFrameSeries, range: TimeRangeSec): SlowFrameSeries {
  if (slow.time.length === 0) return slow;
  const i0 = lowerBound(slow.time, range.start);
  const i1 = upperBound(slow.time, range.end);
  if (i0 >= i1) return { time: new Float32Array(), vbat: new Float32Array(), amperage: new Float32Array() };
  return {
    time: slow.time.slice(i0, i1),
    vbat: slow.vbat.length > 0 ? slow.vbat.slice(i0, i1) : slow.vbat,
    amperage: slow.amperage.length > 0 ? slow.amperage.slice(i0, i1) : slow.amperage,
  };
}

function sliceGps(gps: GpsFrameSeries, range: TimeRangeSec): GpsFrameSeries {
  if (gps.time.length === 0) return gps;
  const i0 = lowerBound(gps.time, range.start);
  const i1 = upperBound(gps.time, range.end);
  if (i0 >= i1) {
    return {
      time: new Float32Array(), lat: new Float32Array(), lon: new Float32Array(),
      altitude: new Float32Array(), speed: new Float32Array(), numSat: new Float32Array(),
    };
  }
  return {
    time: gps.time.slice(i0, i1),
    lat: gps.lat.slice(i0, i1),
    lon: gps.lon.slice(i0, i1),
    altitude: gps.altitude.slice(i0, i1),
    speed: gps.speed.slice(i0, i1),
    numSat: gps.numSat.slice(i0, i1),
  };
}

function emptySlice(log: ParsedLog): ParsedLog {
  const empty = () => new Float32Array(0);
  const triplet: Axis3 = [empty(), empty(), empty()] as const;
  const quad: Axis4 = [empty(), empty(), empty(), empty()] as const;
  return {
    ...log,
    time: empty(),
    gyroFilt: triplet,
    gyroRaw: triplet,
    pTerm: triplet,
    iTerm: triplet,
    dTerm: [empty(), empty()] as const,
    fTerm: triplet,
    setpoint: quad,
    rcCommand: quad,
    motor: log.motor.map(empty),
    eRpm: log.eRpm.map(empty),
    slow: { time: empty(), vbat: empty(), amperage: empty() },
    gps: { time: empty(), lat: empty(), lon: empty(), altitude: empty(), speed: empty(), numSat: empty() },
  };
}

/** First index i such that arr[i] >= target. */
function lowerBound(arr: Float32Array, target: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid]! < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** First index i such that arr[i] > target (exclusive end). */
function upperBound(arr: Float32Array, target: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid]! <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
