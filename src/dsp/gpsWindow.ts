import type { GpsFrameSeries, ParsedLog } from '../types';
import type { TimeRangeSec } from '../sliceLog';
import { gpsCoordValid } from './gpsPlayback';

/**
 * Clamp a global analysis window onto the gyro timeline of this log so both
 * `sliceLog(...)` and callers share the same semantics.
 */
export function clampTimeRangeToLog(range: TimeRangeSec, log: ParsedLog): TimeRangeSec {
  if (log.time.length === 0) return range;
  const tLo = log.time[0]!;
  const tHi = log.time[log.time.length - 1]!;
  let start = Math.min(Math.max(range.start, tLo), tHi);
  let end = Math.min(Math.max(range.end, tLo), tHi);
  if (!(end > start)) {
    start = tLo;
    end = Math.max(start, tHi);
  }
  return { start, end };
}

/**
 * Infer the first telemetry time after the usual pre-lock plateau (often
 * altitude ≈ 0 and/or very few satellites) when the navigator becomes useful.
 *
 * Only returns a cutoff when there is clearly a bogus prefix (`hadBogusBefore`);
 * otherwise returns `null` so callers keep the full gyro window.
 */
export function gpsMeaningfulStartSec(gps: GpsFrameSeries): number | null {
  const n = gps.time.length;
  if (n < 4) return null;

  const validAlts: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!gpsCoordValid(gps.lat[i]!, gps.lon[i]!)) continue;
    const a = gps.altitude[i]!;
    if (Number.isFinite(a)) validAlts.push(a);
  }
  if (validAlts.length < 6) return null;

  validAlts.sort((x, y) => x - y);
  const ref = validAlts[Math.min(validAlts.length - 1, Math.floor(validAlts.length * 0.58))]!;
  if (!(ref > 30)) return null;

  const thresh = Math.max(30, Math.min(ref * 0.18, 220));

  let onsetIdx: number | null = null;
  for (let i = 0; i < n; i++) {
    if (!gpsCoordValid(gps.lat[i]!, gps.lon[i]!)) continue;
    const a = gps.altitude[i]!;
    if (!Number.isFinite(a) || a < thresh) continue;
    onsetIdx = i;
    break;
  }
  if (onsetIdx == null) return null;

  let hadBogusBefore = false;
  for (let j = 0; j < onsetIdx; j++) {
    if (!gpsCoordValid(gps.lat[j]!, gps.lon[j]!)) continue;
    const a = gps.altitude[j]!;
    if (Number.isFinite(a) && a <= 12) {
      hadBogusBefore = true;
      break;
    }
  }
  if (!hadBogusBefore) return null;

  return gps.time[onsetIdx]!;
}

/**
 * GPS tab view range: intersection of the global gyro window with the log
 * timeline, then — when we can detect a bogus pre-lock prefix — a later start
 * time at first plausible climb/fix.
 */
export function gpsViewerEffectiveRange(log: ParsedLog, gyroRange: TimeRangeSec): TimeRangeSec {
  const base = clampTimeRangeToLog(gyroRange, log);
  const lock = gpsMeaningfulStartSec(log.gps);
  if (lock == null) return base;
  if (lock <= base.start + 1e-6) return base;
  if (lock >= base.end - 1e-6) return base;
  return { start: lock, end: base.end };
}
