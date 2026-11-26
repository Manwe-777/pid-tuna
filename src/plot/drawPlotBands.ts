import type uPlot from 'uplot';

import type { PlotBand } from '../types';

/** Fills each band's x span behind the data, clipped to the plot area. */
export function drawPlotBands(u: uPlot, bands: PlotBand[] | undefined) {
  if (!bands || bands.length === 0) return;
  const ctx = u.ctx;
  const top = u.bbox.top;
  const bottom = top + u.bbox.height;
  const left = u.bbox.left;
  const right = left + u.bbox.width;
  ctx.save();

  for (const b of bands) {
    const x0 = u.valToPos(b.x0, 'x', true);
    const x1 = u.valToPos(b.x1, 'x', true);
    if (x1 < left || x0 > right) continue;
    const xa = Math.max(left, x0);
    const xb = Math.min(right, x1);
    ctx.fillStyle = b.fill;
    ctx.fillRect(xa, top, xb - xa, bottom - top);
  }

  ctx.restore();
}
