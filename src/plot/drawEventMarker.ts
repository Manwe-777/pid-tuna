import { LOG_EVENT_STYLES, PLOT_EVENT_INSET_PX, PLOT_EVENT_RADIUS_PX } from '../constants';
import type { LogEventKind } from '../types';

/**
 * One log event: a dashed line down the plot under a power-icon circle at the
 * top. Arming is a filled circle, disarming a ring. Coordinates are canvas
 * units; `s` is canvas units per CSS px.
 */
export function drawEventMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  top: number,
  bottom: number,
  kind: LogEventKind,
  s: number,
) {
  const { color } = LOG_EVENT_STYLES[kind];
  const r = PLOT_EVENT_RADIUS_PX * s;
  const cy = top + (PLOT_EVENT_INSET_PX + PLOT_EVENT_RADIUS_PX) * s;
  const lineX = Math.round(x) + 0.5;
  ctx.save();

  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = s;
  ctx.setLineDash([4 * s, 3 * s]);
  ctx.beginPath();
  ctx.moveTo(lineX, cy + r);
  ctx.lineTo(lineX, bottom);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(x, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = kind === 'arm' ? color : 'rgba(15, 20, 27, 0.85)';
  ctx.fill();
  ctx.lineWidth = 1.5 * s;
  ctx.stroke();

  drawPowerGlyph(ctx, x, cy, r, kind === 'arm' ? '#0b0d10' : color, s);
  ctx.restore();
}

/** The power symbol: an open ring with a bar through its gap. */
function drawPowerGlyph(ctx: CanvasRenderingContext2D, x: number, cy: number, r: number, color: string, s: number) {
  const gap = 0.75;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, cy + 0.06 * r, 0.5 * r, -Math.PI / 2 + gap, (3 * Math.PI) / 2 - gap);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, cy - 0.62 * r);
  ctx.lineTo(x, cy - 0.05 * r);
  ctx.stroke();
}
