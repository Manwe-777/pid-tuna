import type { ParsedLog, TimeRangeSec } from '../types';

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
