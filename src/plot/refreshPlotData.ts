import type uPlot from 'uplot';
import type { AlignedData } from 'uplot';

import { fitYRange } from './fitYRange';
import { visibleYRange } from './visibleYRange';

/**
 * Swaps in new data, keeping the current X range (the user's zoom), refits Y to the
 * visible part of the new data, and redraws. uPlot's `setData(data, false)` alone keeps
 * the scales but doesn't redraw, so the old curves would stay on screen.
 */
export function refreshPlotData(u: uPlot, data: AlignedData, pinned: { yMin?: number; yMax?: number }): void {
  const { min, max } = u.scales.x ?? {};
  u.setData(data, false);

  if (min != null && max != null) {
    const y = fitYRange(visibleYRange(u, min, max), pinned);
    if (y) u.setScale('y', y);
  }

  u.redraw(true, true);
}
