import { DENSITY_MARGIN as M } from '../constants';
import type { ErrorSetpointResult, PlotGeom } from '../types';
import { viridis } from '../utils/viridis';
import { drawCanvasXAxis } from './drawCanvasXAxis';
import { drawCanvasYAxis } from './drawCanvasYAxis';
import { drawPlotFrame } from './drawPlotFrame';
import { drawPlotMessage } from './drawPlotMessage';
import { drawScaledImage } from './drawScaledImage';
import { formatTickCompact } from './formatTickCompact';
import { paintPlotBackground } from './paintPlotBackground';
import { setPixel } from './setPixel';

interface DrawOpts {
  title?: string;
  xLabel: string;
  yLabel: string;
}

/** Empty cells stay at the plot background colour. */
const EMPTY: readonly [number, number, number] = [15, 20, 27];

/** Pixels at bin resolution: setpoint across, error up (+error at the top). */
function densityImage(data: ErrorSetpointResult): ImageData {
  const img = new ImageData(data.xBins, data.yBins);

  for (let yb = 0; yb < data.yBins; yb++) {
    const imgY = data.yBins - 1 - yb;
    const rowBase = yb * data.xBins;

    for (let xb = 0; xb < data.xBins; xb++) {
      const v = data.density[rowBase + xb]!;
      setPixel(img.data, (imgY * data.xBins + xb) * 4, v <= 0 ? EMPTY : viridis(v));
    }
  }

  return img;
}

/** Dashed lines at error = 0 (ideal) and setpoint = 0. */
function drawZeroLines(ctx: CanvasRenderingContext2D, x0: number, y0: number, plotW: number, plotH: number) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(M.left, y0);
  ctx.lineTo(M.left + plotW, y0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x0, M.top);
  ctx.lineTo(x0, M.top + plotH);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Mean error per setpoint bin, where the cloud's centre sits; gaps where a bin has no data. */
function drawMeanError(
  ctx: CanvasRenderingContext2D,
  data: ErrorSetpointResult,
  xToPx: (v: number) => number,
  yToPx: (v: number) => number,
) {
  ctx.strokeStyle = '#ff9f43';
  ctx.lineWidth = 2;
  ctx.beginPath();
  let drawing = false;

  for (let xb = 0; xb < data.xBins; xb++) {
    const e = data.meanError[xb];

    if (e == null || !Number.isFinite(e)) {
      drawing = false;
      continue;
    }

    const px = xToPx(data.xCenters[xb]!);
    const py = yToPx(Math.max(-data.errorRange, Math.min(data.errorRange, e)));
    if (drawing) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
    drawing = true;
  }

  ctx.stroke();
}

/** Setpoint × tracking-error density with zero lines and the mean error; returns the crosshair geometry. */
export function drawErrorDensity(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: ErrorSetpointResult,
  opts: DrawOpts,
): PlotGeom | null {
  paintPlotBackground(ctx, width, height, M, opts.title, 8);
  const plotW = width - M.left - M.right;
  const plotH = height - M.top - M.bottom;
  if (plotW <= 1 || plotH <= 1) return null;

  if (data.sampleCount === 0 || data.density.length === 0) {
    drawPlotMessage(ctx, M, plotW, plotH, 'No setpoint/gyro coverage in this window');

    return null;
  }

  drawScaledImage(ctx, densityImage(data), M, plotW, plotH, 'low');

  const sp = data.setpointRange;
  const er = data.errorRange;
  const xToPx = (v: number) => M.left + ((v + sp) / (2 * sp)) * plotW;
  const yToPx = (v: number) => M.top + (1 - (v + er) / (2 * er)) * plotH;
  drawZeroLines(ctx, Math.round(xToPx(0)) + 0.5, Math.round(yToPx(0)) + 0.5, plotW, plotH);
  drawMeanError(ctx, data, xToPx, yToPx);
  // Frame keeps the mean line's width, as it always has.
  drawPlotFrame(ctx, M, plotW, plotH);

  const format = formatTickCompact;
  drawCanvasXAxis(ctx, M.left, M.top + plotH, plotW, -sp, sp, opts.xLabel, { ticks: 6, format, labelAt: 'center' });
  drawCanvasYAxis(ctx, M.left, M.top, plotH, -er, er, opts.yLabel, { ticks: 6, format, labelOffset: 44 });

  return {
    left: M.left,
    top: M.top,
    plotW,
    plotH,
    xMin: -sp,
    xMax: sp,
    yMin: -er,
    yMax: er,
    fmtX: (v) => `${v.toFixed(0)}°/s`,
    fmtY: (v) => `${v.toFixed(0)}°/s`,
  };
}
