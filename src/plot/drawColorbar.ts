import { CANVAS_TICK_FONT } from '../constants';
import { niceTicks } from '../utils/niceTicks';
import { viridis } from '../utils/viridis';

/**
 * Vertical viridis scale from floorDb (bottom) to ceilDb (top). Tick labels read
 * "-40 dB", or plain numbers with `unit` written above the bar when given.
 */
export function drawColorbar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  floorDb: number,
  ceilDb: number,
  unit?: string,
) {
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  const stops = 8;

  for (let i = 0; i <= stops; i++) {
    const t = 1 - i / stops; // top = high
    const [r, g, b] = viridis(t);
    grad.addColorStop(i / stops, `rgb(${r}, ${g}, ${b})`);
  }

  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#1d242e';
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  ctx.fillStyle = '#9aa4b2';
  ctx.font = CANVAS_TICK_FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const range = ceilDb - floorDb || 1;

  for (const db of niceTicks(floorDb, ceilDb, 5)) {
    const py = y + (1 - (db - floorDb) / range) * h;
    ctx.fillText(unit == null ? `${Math.round(db)} dB` : `${Math.round(db)}`, x + w + 4, py);
  }

  if (unit == null) return;
  ctx.textAlign = 'left';
  ctx.fillText(unit, x - 2, y - 8);
}
