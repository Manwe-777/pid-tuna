import { CANVAS_TITLE_FONT } from '../constants';
import type { PlotMargin } from '../types';

/** Clears the canvas to the plot background and draws the title at the top left. */
export function paintPlotBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  margin: PlotMargin,
  title: string | undefined,
  titleY: number,
) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0f141b';
  ctx.fillRect(0, 0, width, height);
  if (!title) return;

  ctx.fillStyle = '#c8ced9';
  ctx.font = CANVAS_TITLE_FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(title, margin.left, titleY);
}
