import { useEffect, useRef, useState } from 'react';
import type { ThrottleSpectrogramResult } from '../dsp/spectrogram';

export interface ThrottleSpecPlotProps {
  data: ThrottleSpectrogramResult;
  title?: string;
  floorDb?: number;
  /** Optional maximum frequency (Hz) to display. */
  maxFreqHz?: number;
  height?: number;
}

const MARGIN = { top: 28, right: 64, bottom: 32, left: 52 } as const;
const DEFAULT_FLOOR_DB = -80;

export function ThrottleSpecPlot({
  data,
  title,
  floorDb = DEFAULT_FLOOR_DB,
  maxFreqHz,
  height = 280,
}: ThrottleSpecPlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, width * dpr);
    canvas.height = Math.max(1, height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, width, height, data, { title, floorDb, maxFreqHz });
  }, [data, width, height, title, floorDb, maxFreqHz]);

  return (
    <div className="plot" ref={containerRef}>
      <canvas ref={canvasRef} />
    </div>
  );
}

interface DrawOpts {
  title?: string;
  floorDb: number;
  maxFreqHz?: number;
}

function draw(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: ThrottleSpectrogramResult,
  opts: DrawOpts,
) {
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
  if (plotW <= 1 || plotH <= 1) return;

  if (data.throttleBins === 0 || data.freqBins === 0 || data.magnitudes.length === 0) {
    ctx.fillStyle = '#8a93a3';
    ctx.font = '12px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No throttle/signal coverage in this window', MARGIN.left + plotW / 2, MARGIN.top + plotH / 2);
    return;
  }

  // Frequency range.
  const nyquist = data.frequencies[data.frequencies.length - 1] ?? 0;
  const fMax = opts.maxFreqHz != null ? Math.min(opts.maxFreqHz, nyquist) : nyquist;
  const fStep = data.frequencies.length > 1 ? (data.frequencies[1]! - data.frequencies[0]!) : 0;
  const maxFreqBin = fStep > 0
    ? Math.min(data.freqBins - 1, Math.round(fMax / fStep))
    : data.freqBins - 1;
  const visibleFreqBins = maxFreqBin + 1;
  const displayedFMax = data.frequencies[maxFreqBin] ?? fMax;

  // ImageData: width = visibleFreqBins (x = frequency), height = throttleBins (y = throttle).
  // Image Y=0 at top, but we want throttle 100% at top so iterate accordingly.
  const img = new ImageData(visibleFreqBins, data.throttleBins);
  const range = -opts.floorDb;
  const px = img.data;
  for (let t = 0; t < data.throttleBins; t++) {
    const imgY = data.throttleBins - 1 - t; // throttle 0% at bottom
    const rowBase = t * data.freqBins;
    for (let f = 0; f <= maxFreqBin; f++) {
      const db = data.magnitudes[rowBase + f]!;
      const norm = Math.max(0, Math.min(1, (db - opts.floorDb) / range));
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
  off.height = data.throttleBins;
  off.getContext('2d')!.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'low';
  ctx.drawImage(off, MARGIN.left, MARGIN.top, plotW, plotH);

  ctx.strokeStyle = '#1d242e';
  ctx.lineWidth = 1;
  ctx.strokeRect(MARGIN.left + 0.5, MARGIN.top + 0.5, plotW - 1, plotH - 1);

  // X = frequency.
  drawXAxis(ctx, MARGIN.left, MARGIN.top + plotH, plotW, 0, displayedFMax, 'Hz');
  // Y = throttle %.
  drawYAxis(ctx, MARGIN.left, MARGIN.top, plotH, 0, data.throttleBins, 'throttle %');

  drawColorbar(ctx, width - MARGIN.right + 14, MARGIN.top, 12, plotH, opts.floorDb);
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
  ctx.textAlign = 'right';
  ctx.fillStyle = '#8a93a3';
  ctx.fillText(label, x + w, y + 20);
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
  ctx.translate(x - 36, y + h / 2);
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
  floorDb: number,
) {
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  const stops = 8;
  for (let i = 0; i <= stops; i++) {
    const t = 1 - i / stops;
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
  for (const db of [0, -20, -40, -60, floorDb]) {
    if (db < floorDb) continue;
    const py = y + (-db / -floorDb) * h;
    ctx.fillText(`${db} dB`, x + w + 4, py);
  }
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
  if (Math.abs(n) >= 100) return n.toFixed(0);
  if (Math.abs(n) >= 10) return n.toFixed(1);
  if (Math.abs(n) >= 1) return n.toFixed(2);
  return n.toFixed(3);
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
