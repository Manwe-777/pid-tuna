import type { TimeSpan } from '../types';

/**
 * The Y scale for new data: the visible values with a little padding, with pinned
 * bounds taking their side. Null when there is nothing to fit and nothing pinned.
 */
export function fitYRange(
  visible: { lo: number; hi: number } | null,
  pinned: { yMin?: number; yMax?: number },
): TimeSpan | null {
  if (pinned.yMin != null && pinned.yMax != null) return { min: pinned.yMin, max: pinned.yMax };
  if (!visible) return null;
  const spread = visible.hi - visible.lo;
  const pad = spread > 0 ? spread * 0.06 : Math.max(1, Math.abs(visible.hi) * 0.1);
  const min = pinned.yMin ?? visible.lo - pad;
  const max = pinned.yMax ?? visible.hi + pad;

  return max > min ? { min, max } : null;
}
