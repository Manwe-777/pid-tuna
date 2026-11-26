import type { TimeRangeSec } from '../types';

/** The whole log, minus 5 s at each end when it is longer than 12 s (arming and landing). */
export function defaultTimeRange(duration: number): TimeRangeSec {
  return {
    start: duration > 12 ? 5 : 0,
    end: duration > 12 ? duration - 5 : duration,
  };
}
