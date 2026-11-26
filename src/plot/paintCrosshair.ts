import { CANVAS_TICK_FONT } from '../constants';
import type { PlotGeom } from '../types';

function insidePlot(g: PlotGeom, mx: number, my: number): boolean {
  return mx >= g.left && mx <= g.left + g.plotW && my >= g.top && my <= g.top + g.plotH;
}

function drawCrosshairLines(ctx: CanvasRenderingContext2D, g: PlotGeom, mx: number, my: number) {
  const cx = Math.round(mx) + 0.5;
  const cy = Math.round(my) + 0.5;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(g.left, cy);
  ctx.lineTo(g.left + g.plotW, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, g.top);
  ctx.lineTo(cx, g.top + g.plotH);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Top-left of the value label: up-right of the cursor, flipped to stay inside the plot. */
function labelPosition(g: PlotGeom, mx: number, my: number, bw: number, bh: number): { bx: number; by: number } {
  let bx = mx + 12;
  let by = my - bh - 8;
  if (bx + bw > g.left + g.plotW) bx = mx - bw - 12;
  if (bx < g.left) bx = g.left + 2;
  if (by < g.top) by = my + 12;

  return { bx, by };
}

function drawValueLabel(ctx: CanvasRenderingContext2D, g: PlotGeom, mx: number, my: number) {
  const xv = g.xMin + ((mx - g.left) / g.plotW) * (g.xMax - g.xMin);
  const yv = g.yMax - ((my - g.top) / g.plotH) * (g.yMax - g.yMin);
  const text = `${g.fmtX(xv)}  ·  ${g.fmtY(yv)}`;

  ctx.font = CANVAS_TICK_FONT;
  const pad = 6;
  const bw = ctx.measureText(text).width + pad * 2;
  const bh = 19;
  const { bx, by } = labelPosition(g, mx, my, bw, bh);

  ctx.fillStyle = 'rgba(13, 17, 23, 0.9)';
  ctx.strokeStyle = '#3a4150';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeRect(bx + 0.5, by + 0.5, bw, bh);
  ctx.fillStyle = '#e6e6e6';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + pad, by + bh / 2 + 0.5);
}

/** Paint (or clear, when mx/my are null) the crosshair overlay. mx/my are CSS px
 *  relative to the canvas. */
export function paintCrosshair(
  canvas: HTMLCanvasElement,
  cssW: number,
  cssH: number,
  geom: PlotGeom | null,
  mx: number | null,
  my: number | null,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  if (geom == null || mx == null || my == null || !insidePlot(geom, mx, my)) return;

  drawCrosshairLines(ctx, geom, mx, my);
  drawValueLabel(ctx, geom, mx, my);
}
