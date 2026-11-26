import type { ParsedLog, TimeRangeSec } from '../../types';
import { clampTimeRangeToLog } from '../clampTimeRangeToLog';
import { gpsMeaningfulStartSec } from './gpsMeaningfulStartSec';

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
