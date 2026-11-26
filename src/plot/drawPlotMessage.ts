import { CANVAS_MESSAGE_FONT } from '../constants';
import type { PlotMargin } from '../types';

/** Centres a message (e.g. "no data") in the plot area. */
export function drawPlotMessage(
  ctx: CanvasRenderingContext2D,
  m: PlotMargin,
  plotW: number,
  plotH: number,
  text: string,
) {
  ctx.fillStyle = '#8a93a3';
  ctx.font = CANVAS_MESSAGE_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, m.left + plotW / 2, m.top + plotH / 2);
}
