import type uPlot from 'uplot';

import type { PlotMarker } from '../types';

/** Draws each marker as a full-height vertical line, skipping those outside the plot area. */
export function drawPlotMarkers(u: uPlot, markers: PlotMarker[] | undefined) {
  if (!markers?.length) return;
  const ctx = u.ctx;
  const left = u.bbox.left;
  const right = left + u.bbox.width;
  const top = u.bbox.top;
  const bottom = top + u.bbox.height;
  ctx.save();

  for (const m of markers) {
    const xPx = Math.round(u.valToPos(m.x, 'x', true)) + 0.5;
    if (xPx < left || xPx > right) continue;
    ctx.strokeStyle = m.stroke;
    ctx.lineWidth = m.width ?? 1;
    ctx.setLineDash(m.dash ?? []);
    ctx.beginPath();
    ctx.moveTo(xPx, top);
    ctx.lineTo(xPx, bottom);
    ctx.stroke();
  }

  ctx.restore();
}
