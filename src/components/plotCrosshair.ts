/**
 * Shared hover-crosshair painter for the canvas heatmaps (spectrogram, binned
 * spectrogram, error/setpoint density). Each plot records its drawn geometry in
 * a ref during draw(); on mouse move the component maps the pointer to data
 * coordinates and calls this to paint a dashed crosshair + a value readout on a
 * dedicated overlay canvas (so the heavy heatmap never redraws on hover).
 */

export interface PlotGeom {
  /** Plot-area rect in CSS px. */
  left: number;
  top: number;
  plotW: number;
  plotH: number;
  /** Data-value range mapped across the rect. Top of the plot = yMax. */
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  fmtX: (v: number) => string;
  fmtY: (v: number) => string;
}

const FONT = '11px -apple-system, system-ui, sans-serif';

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
  if (geom == null || mx == null || my == null) return;

  const { left, top, plotW, plotH } = geom;
  if (mx < left || mx > left + plotW || my < top || my > top + plotH) return;

  const cx = Math.round(mx) + 0.5;
  const cy = Math.round(my) + 0.5;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(left, cy);
  ctx.lineTo(left + plotW, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.lineTo(cx, top + plotH);
  ctx.stroke();
  ctx.setLineDash([]);

  const xv = geom.xMin + ((mx - left) / plotW) * (geom.xMax - geom.xMin);
  const yv = geom.yMax - ((my - top) / plotH) * (geom.yMax - geom.yMin);
  const text = `${geom.fmtX(xv)}  ·  ${geom.fmtY(yv)}`;

  ctx.font = FONT;
  const pad = 6;
  const bw = ctx.measureText(text).width + pad * 2;
  const bh = 19;
  let bx = mx + 12;
  let by = my - bh - 8;
  if (bx + bw > left + plotW) bx = mx - bw - 12;
  if (bx < left) bx = left + 2;
  if (by < top) by = my + 12;

  ctx.fillStyle = 'rgba(13, 17, 23, 0.9)';
  ctx.strokeStyle = '#3a4150';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeRect(bx + 0.5, by + 0.5, bw, bh);
  ctx.fillStyle = '#e6e6e6';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + pad, by + bh / 2 + 0.5);
}
