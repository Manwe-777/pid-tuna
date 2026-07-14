import { useEffect, useRef, useState } from 'react';
import type { BinnedSpectrogramResult } from '../dsp/spectrogram';
import { paintCrosshair, type PlotGeom } from './plotCrosshair';

export interface BinnedSpecPlotProps {
  data: BinnedSpectrogramResult;
  /** Y-axis (domain) label, e.g. "throttle %" or "motor freq (Hz)". */
  yLabel: string;
  title?: string;
  /** Optional maximum frequency (Hz) to display on the X axis. */
  maxFreqHz?: number;
  /** Colour-scale bottom in dB (default -80). */
  dbFloor?: number;
  /** Colour-scale top in dB (default 0). */
  dbCeil?: number;
  /** Colorbar unit label (e.g. "dB" or "dBm/Hz"). */
  valueUnit?: string;
  height?: number;
}

const MARGIN = { top: 24, right: 72, bottom: 40, left: 60 } as const;

/**
 * Blackbox-Explorer-style binned heatmap: frequency along the X axis, an
 * arbitrary binned domain (throttle % or motor frequency) up the Y axis,
 * coloured by the gyro spectrum. Dark by design — viridis reads on a dark
 * ground, so this stays dark in both app themes.
 */
export function BinnedSpecPlot({
  data,
  yLabel,
  title,
  maxFreqHz,
  dbFloor = -80,
  dbCeil = 0,
  valueUnit = 'dB',
  height = 460,
}: BinnedSpecPlotProps) {
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
    geomRef.current = draw(ctx, width, height, data, { title, yLabel, maxFreqHz, dbFloor, dbCeil, valueUnit });
    if (overlay) paintCrosshair(overlay, width, height, geomRef.current, null, null);
  }, [data, width, height, title, yLabel, maxFreqHz, dbFloor, dbCeil, valueUnit]);

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
  yLabel: string;
  maxFreqHz?: number;
  dbFloor: number;
  dbCeil: number;
  valueUnit: string;
}

function draw(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: BinnedSpectrogramResult,
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
    ctx.fillText(opts.title, MARGIN.left, 6);
  }

  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;
  if (plotW <= 1 || plotH <= 1) return null;

  if (data.xBins === 0 || data.freqBins === 0 || data.magnitudes.length === 0) {
    ctx.fillStyle = '#8a93a3';
    ctx.font = '12px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No coverage for this domain in the window', MARGIN.left + plotW / 2, MARGIN.top + plotH / 2);
    return null;
  }

  // Displayed frequency range (X axis).
  const nyquist = data.frequencies[data.frequencies.length - 1] ?? 0;
  const fMax = opts.maxFreqHz != null ? Math.min(opts.maxFreqHz, nyquist) : nyquist;
  const fStep = data.frequencies.length > 1 ? (data.frequencies[1]! - data.frequencies[0]!) : 0;
  const maxFreqBin = fStep > 0 ? Math.min(data.freqBins - 1, Math.round(fMax / fStep)) : data.freqBins - 1;
  const visibleFreqBins = maxFreqBin + 1;
  const displayedFMax = data.frequencies[maxFreqBin] ?? fMax;

  // Domain (Y axis) range from the bin centers.
  const yc = data.xCenters;
  const yStep = yc.length > 1 ? yc[1]! - yc[0]! : 1;
  const yMin = (yc[0] ?? 0) - yStep / 2;
  const yMax = (yc[yc.length - 1] ?? 1) + yStep / 2;

  // ImageData: width = visibleFreqBins (X = frequency), height = xBins (Y = domain).
  // Flip Y so the low domain value sits at the bottom.
  const img = new ImageData(visibleFreqBins, data.xBins);
  const range = opts.dbCeil - opts.dbFloor || 1;
  const px = img.data;
  for (let x = 0; x < data.xBins; x++) {
    const imgY = data.xBins - 1 - x;
    const rowBase = x * data.freqBins;
    for (let f = 0; f <= maxFreqBin; f++) {
      const db = data.magnitudes[rowBase + f]!;
      const norm = Math.max(0, Math.min(1, (db - opts.dbFloor) / range));
      const idx = (imgY * visibleFreqBins + f) * 4;
      const [r, g, b] = viridis(norm);
      px[idx] = r;
      px[idx + 1] = g;
      px[idx + 2] = b;
      px[idx + 3] = 255;
    }
  }

  const off = document.createElement('canvas');
  off.width = visibleFreqBins;
  off.height = data.xBins;
  off.getContext('2d')!.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(off, MARGIN.left, MARGIN.top, plotW, plotH);

  ctx.strokeStyle = '#1d242e';
  ctx.lineWidth = 1;
  ctx.strokeRect(MARGIN.left + 0.5, MARGIN.top + 0.5, plotW - 1, plotH - 1);

  drawXAxis(ctx, MARGIN.left, MARGIN.top + plotH, plotW, 0, displayedFMax, 'Hz');
  drawYAxis(ctx, MARGIN.left, MARGIN.top, plotH, yMin, yMax, opts.yLabel);
  drawColorbar(ctx, width - MARGIN.right + 16, MARGIN.top, 12, plotH, opts.dbFloor, opts.dbCeil, opts.valueUnit);

  return {
    left: MARGIN.left,
    top: MARGIN.top,
    plotW,
    plotH,
    xMin: 0,
    xMax: displayedFMax,
    yMin,
    yMax,
    fmtX: (v) => `${v.toFixed(0)} Hz`,
    fmtY: opts.yLabel.includes('%')
      ? (v) => `${v.toFixed(0)}%`
      : (v) => `${v.toFixed(0)} Hz`,
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
  const ticks = niceTicks(min, max, 8);
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
  ctx.translate(x - 42, y + h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#8a93a3';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(label, 0, 0);
  ctx.restore();
}

function drawColorbar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  dbFloor: number,
  dbCeil: number,
  unit: string,
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
  ctx.font = '11px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const range = dbCeil - dbFloor || 1;
  for (const db of niceTicks(dbFloor, dbCeil, 5)) {
    const py = y + (1 - (db - dbFloor) / range) * h;
    ctx.fillText(`${Math.round(db)}`, x + w + 4, py);
  }
  ctx.textAlign = 'left';
  ctx.fillText(unit, x - 2, y - 8);
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
