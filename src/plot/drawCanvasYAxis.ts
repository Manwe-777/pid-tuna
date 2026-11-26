import { CANVAS_TICK_FONT } from '../constants';
import { niceTicks } from '../utils/niceTicks';
import type { CanvasAxisStyle } from './drawCanvasXAxis';

/** Ticks left of the plot area, with the axis label rotated `labelOffset` px further left. */
export function drawCanvasYAxis(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  min: number,
  max: number,
  label: string,
  style: CanvasAxisStyle & { labelOffset: number },
) {
  const ticks = niceTicks(min, max, style.ticks);
  ctx.fillStyle = '#9aa4b2';
  ctx.font = CANVAS_TICK_FONT;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#3a4150';
  ctx.lineWidth = 1;

  for (const v of ticks) {
    const py = y + h - ((v - min) / (max - min || 1)) * h;
    ctx.beginPath();
    ctx.moveTo(x - 4, py);
    ctx.lineTo(x, py);
    ctx.stroke();
    ctx.fillText(style.format(v), x - 6, py);
  }

  ctx.save();
  ctx.translate(x - style.labelOffset, y + h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#8a93a3';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(label, 0, 0);
  ctx.restore();
}
