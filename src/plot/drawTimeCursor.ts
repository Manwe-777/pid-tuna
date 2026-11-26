import { SPECTROGRAM_MARGIN as M } from '../constants';
import type { SpectrogramResult } from '../types';
import { sizeCanvas } from './sizeCanvas';

/** Clears the cursor canvas and draws a dashed vertical line at `cursorTime` when it falls inside the data. */
export function drawTimeCursor(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  data: SpectrogramResult,
  cursorTime: number | undefined,
) {
  const dpr = window.devicePixelRatio || 1;
  sizeCanvas(canvas, width, height, dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (cursorTime == null || data.times.length === 0) return;

  const tMin = data.times[0]!;
  const tMax = data.times[data.times.length - 1]!;
  if (cursorTime < tMin || cursorTime > tMax) return;
  const plotW = width - M.left - M.right;
  const plotH = height - M.top - M.bottom;
  const x = M.left + ((cursorTime - tMin) / (tMax - tMin || 1)) * plotW;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(Math.round(x) + 0.5, M.top);
  ctx.lineTo(Math.round(x) + 0.5, M.top + plotH);
  ctx.stroke();
}
