import type uPlot from 'uplot';

import { visibleYRange } from './visibleYRange';

/** True when [xLo, xHi] matches the pinned X range (or the data's ends where unpinned). */
function atPinnedRange(xData: ArrayLike<number>, xLo: number, xHi: number, min?: number, max?: number): boolean {
  const pinnedLo = min ?? xData[0]!;
  const pinnedHi = max ?? xData[xData.length - 1]!;
  const span = Math.max(1e-9, pinnedHi - pinnedLo);
  const eps = span * 1e-4;

  return Math.abs(xLo - pinnedLo) < eps && Math.abs(xHi - pinnedHi) < eps;
}

/**
 * After an X change (drag-zoom), refit Y to the visible samples. Skipped when X
 * is at its caller-pinned range: that's the init/reset path, where Y stays at
 * its pinned/auto bounds.
 */
export function refitYToVisible(u: uPlot, pinnedMin: number | undefined, pinnedMax: number | undefined) {
  const xLo = u.scales.x?.min;
  const xHi = u.scales.x?.max;
  const xData = u.data[0];
  if (xLo == null || xHi == null || !xData || xData.length === 0) return;
  if (atPinnedRange(xData, xLo, xHi, pinnedMin, pinnedMax)) return;

  const range = visibleYRange(u, xLo, xHi);
  if (!range || range.hi <= range.lo) return;
  const pad = (range.hi - range.lo) * 0.06;
  u.setScale('y', { min: range.lo - pad, max: range.hi + pad });
}
