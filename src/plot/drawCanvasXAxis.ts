import { CANVAS_TICK_FONT } from '../constants';
import { niceTicks } from '../utils/niceTicks';

export interface CanvasAxisStyle {
  /** About how many ticks to draw. */
  ticks: number;
  format: (v: number) => string;
}

/**
 * Ticks and labels under the plot area. The axis label sits right-aligned under
 * the end (`end`), or centred a little lower (`center`).
 */
export function drawCanvasXAxis(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  min: number,
  max: number,
  label: string,
  style: CanvasAxisStyle & { labelAt: 'end' | 'center' },
) {
  const ticks = niceTicks(min, max, style.ticks);
  ctx.fillStyle = '#9aa4b2';
  ctx.font = CANVAS_TICK_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.strokeStyle = '#3a4150';
  ctx.lineWidth = 1;

  for (const v of ticks) {
    const px = x + ((v - min) / (max - min || 1)) * w;
    ctx.beginPath();
    ctx.moveTo(px, y);
    ctx.lineTo(px, y + 4);
    ctx.stroke();
    ctx.fillText(style.format(v), px, y + 6);
  }

  if (style.labelAt === 'end') {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#8a93a3';
    ctx.fillText(label, x + w, y + 6 + 14);

    return;
  }

  ctx.fillStyle = '#8a93a3';
  ctx.fillText(label, x + w / 2, y + 22);
}
