import { useMemo, useState } from 'react';

import type { LogSlot, ParsedLog, TimeRangeSec } from '../types';
import { defaultTimeRange } from '../utils/defaultTimeRange';

/** The analysed time window; it resets to the default when the longest duration or the primary log changes. */
export function useTimeWindow(enabled: Array<{ slot: LogSlot; log: ParsedLog }>) {
  const duration = useMemo(
    () => Math.max(...enabled.map(({ log }) => log.time[log.time.length - 1] ?? 0), 0),
    [enabled],
  );
  const resetKey = `${duration}|${enabled[0]?.slot.id ?? ''}`;
  const [range, setRange] = useState<TimeRangeSec>(() => defaultTimeRange(duration));
  const [rangeKey, setRangeKey] = useState(resetKey);

  if (rangeKey !== resetKey) {
    setRangeKey(resetKey);
    setRange(defaultTimeRange(duration));
  }

  return { duration, range, setRange };
}
