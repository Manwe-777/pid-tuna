import { useEffect, useRef, useState } from 'react';
import type { ErrorSetpointResult } from '../dsp/errorSetpoint';
import { paintCrosshair, type PlotGeom } from './plotCrosshair';

export interface DensityPlotProps {
  data: ErrorSetpointResult;
  title?: string;
  xLabel?: string;
  yLabel?: string;
  height?: number;
}

const MARGIN = { top: 28, right: 24, bottom: 40, left: 60 } as const;

/**
 * 2D density heatmap for "Error vs Setpoint": X = setpoint (deg/s), Y = error
 * (deg/s), colour = log sample density (viridis). Reference lines at error = 0
 * (ideal tracking) and setpoint = 0. Dark by design, like the other heatmaps.
 */
export function DensityPlot({ data, title, xLabel = 'setpoint (deg/s)', yLabel = 'error (deg/s)', height = 300 }: DensityPlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const geomRef = useRef<PlotGeom | null>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    for (const c of [canvas, overlay]) {
      if (!c) continue;
      c.width = Math.max(1, width * dpr);
      c.height = Math.max(1, height * dpr);
      c.style.width = `${width}px`;
      c.style.height = `${height}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    geomRef.current = draw(ctx, width, height, data, { title, xLabel, yLabel });
    if (overlay) paintCrosshair(overlay, width, height, geomRef.current, null, null);
  }, [data, width, height, title, xLabel, yLabel]);

  const onMove = (e: React.MouseEvent) => {
    const overlay = overlayRef.current;
    const canvas = canvasRef.current;
    if (!overlay || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    paintCrosshair(overlay, width, height, geomRef.current, e.clientX - rect.left, e.clientY - rect.top);
  };
  const onLeave = () => {
    const overlay = overlayRef.current;
    if (overlay) paintCrosshair(overlay, width, height, geomRef.current, null, null);
  };

  return (
    <div className="plot" ref={containerRef} style={{ position: 'relative', padding: 0 }} onMouseMove={onMove} onMouseLeave={onLeave}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
      <canvas ref={overlayRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
    </div>
  );
}

interface DrawOpts {
  title?: string;
  xLabel: string;
  yLabel: string;
}

function draw(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: ErrorSetpointResult,
  opts: DrawOpts,
): PlotGeom | null {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0f141b';
  ctx.fillRect(0, 0, width, height);

  if (opts.title) {
    ctx.fillStyle = '#c8ced9';
    ctx.font = '600 13px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(opts.title, MARGIN.left, 8);
  }

  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;
  if (plotW <= 1 || plotH <= 1) return null;

  if (data.sampleCount === 0 || data.density.length === 0) {
    ctx.fillStyle = '#8a93a3';
    ctx.font = '12px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No setpoint/gyro coverage in this window', MARGIN.left + plotW / 2, MARGIN.top + plotH / 2);
    return null;
  }

  // ImageData: width = xBins, height = yBins. Flip Y so +error is at the top.
  const img = new ImageData(data.xBins, data.yBins);
  const px = img.data;
  for (let yb = 0; yb < data.yBins; yb++) {
    const imgY = data.yBins - 1 - yb;
    const rowBase = yb * data.xBins;
    for (let xb = 0; xb < data.xBins; xb++) {
      const v = data.density[rowBase + xb]!;
      const idx = (imgY * data.xBins + xb) * 4;
      if (v <= 0) {
        // Leave empty cells at the plot background colour.
        px[idx] = 15; px[idx + 1] = 20; px[idx + 2] = 27; px[idx + 3] = 255;
      } else {
        const [r, g, b] = viridis(v);
        px[idx] = r; px[idx + 1] = g; px[idx + 2] = b; px[idx + 3] = 255;
      }
    }
  }
  const off = document.createElement('canvas');
  off.width = data.xBins;
  off.height = data.yBins;
  off.getContext('2d')!.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'low';
  ctx.drawImage(off, MARGIN.left, MARGIN.top, plotW, plotH);

  // Reference lines: error = 0 (ideal) and setpoint = 0.
  const xToPx = (v: number) => MARGIN.left + ((v + data.setpointRange) / (2 * data.setpointRange)) * plotW;
  const yToPx = (v: number) => MARGIN.top + (1 - (v + data.errorRange) / (2 * data.errorRange)) * plotH;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  const y0 = Math.round(yToPx(0)) + 0.5;
  ctx.beginPath();
  ctx.moveTo(MARGIN.left, y0);
  ctx.lineTo(MARGIN.left + plotW, y0);
  ctx.stroke();
  const x0 = Math.round(xToPx(0)) + 0.5;
  ctx.beginPath();
  ctx.moveTo(x0, MARGIN.top);
  ctx.lineTo(x0, MARGIN.top + plotH);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = '#1d242e';
  ctx.strokeRect(MARGIN.left + 0.5, MARGIN.top + 0.5, plotW - 1, plotH - 1);

  drawXAxis(ctx, MARGIN.left, MARGIN.top + plotH, plotW, -data.setpointRange, data.setpointRange, opts.xLabel);
  drawYAxis(ctx, MARGIN.left, MARGIN.top, plotH, -data.errorRange, data.errorRange, opts.yLabel);

  return {
    left: MARGIN.left,
    top: MARGIN.top,
    plotW,
    plotH,
    xMin: -data.setpointRange,
    xMax: data.setpointRange,
    yMin: -data.errorRange,
    yMax: data.errorRange,
    fmtX: (v) => `${v.toFixed(0)}°/s`,
    fmtY: (v) => `${v.toFixed(0)}°/s`,
  };
}

function drawXAxis(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  min: number,
  max: number,
  label: string,
) {
  const ticks = niceTicks(min, max, 6);
  ctx.fillStyle = '#9aa4b2';
  ctx.font = '11px -apple-system, system-ui, sans-serif';
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
    ctx.fillText(formatNum(v), px, y + 6);
  }
  ctx.fillStyle = '#8a93a3';
  ctx.fillText(label, x + w / 2, y + 22);
}

function drawYAxis(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  min: number,
  max: number,
  label: string,
) {
  const ticks = niceTicks(min, max, 6);
  ctx.fillStyle = '#9aa4b2';
  ctx.font = '11px -apple-system, system-ui, sans-serif';
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
    ctx.fillText(formatNum(v), x - 6, py);
  }
  ctx.save();
  ctx.translate(x - 44, y + h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#8a93a3';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(label, 0, 0);
  ctx.restore();
}

function niceTicks(min: number, max: number, target: number): number[] {
  if (!(max > min)) return [min];
  const span = max - min;
  const rawStep = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  let step: number;
  if (norm < 1.5) step = 1 * mag;
  else if (norm < 3) step = 2 * mag;
  else if (norm < 7) step = 5 * mag;
  else step = 10 * mag;
  const out: number[] = [];
  const first = Math.ceil(min / step) * step;
  for (let v = first; v <= max + 1e-9; v += step) out.push(v);
  return out;
}

function formatNum(n: number): string {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  if (Math.abs(n) >= 100) return n.toFixed(0);
  if (Math.abs(n) >= 10) return n.toFixed(0);
  if (Math.abs(n) >= 1) return n.toFixed(1);
  return n.toFixed(2);
}

const VIRIDIS: ReadonlyArray<readonly [number, number, number]> = [
  [68, 1, 84],
  [59, 82, 139],
  [33, 145, 140],
  [94, 201, 98],
  [253, 231, 37],
];

function viridis(t: number): readonly [number, number, number] {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  const segs = VIRIDIS.length - 1;
  const pos = c * segs;
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, segs);
  const frac = pos - lo;
  const a = VIRIDIS[lo]!;
  const b = VIRIDIS[hi]!;
  return [
    Math.round(a[0] + (b[0] - a[0]) * frac),
    Math.round(a[1] + (b[1] - a[1]) * frac),
    Math.round(a[2] + (b[2] - a[2]) * frac),
  ];
}
