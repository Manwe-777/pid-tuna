import type { TimeSpan } from '../types';

/**
 * Whether the X scale shows the plot's whole default range: the pinned bounds, or the data
 * where a side has none. A little slack absorbs float rounding.
 */
export function isFullXRange(
  scale: Partial<TimeSpan>,
  data: { first: number; last: number },
  pinned: { xMin?: number; xMax?: number },
): boolean {
  const { min, max } = scale;
  if (min == null || max == null) return true;
  const lo = pinned.xMin ?? data.first;
  const hi = pinned.xMax ?? data.last;
  const slack = (hi - lo) * 1e-6;

  return min <= lo + slack && max >= hi - slack;
}
