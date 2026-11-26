import type { PlotMargin } from '../types';

/** One-pixel outline around the plot area, in the caller's current line width. */
export function drawPlotFrame(ctx: CanvasRenderingContext2D, m: PlotMargin, plotW: number, plotH: number) {
  ctx.strokeStyle = '#1d242e';
  ctx.strokeRect(m.left + 0.5, m.top + 0.5, plotW - 1, plotH - 1);
}
