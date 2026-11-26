import { SPECTROGRAM_MARGIN as M } from '../constants';
import type { PlotGeom, SpectrogramResult } from '../types';
import { dbColor } from './dbColor';
import { drawCanvasXAxis } from './drawCanvasXAxis';
import { drawCanvasYAxis } from './drawCanvasYAxis';
import { drawColorbar } from './drawColorbar';
import { drawPlotFrame } from './drawPlotFrame';
import { drawPlotMessage } from './drawPlotMessage';
import { drawScaledImage } from './drawScaledImage';
import { formatTickPrecise } from './formatTickPrecise';
import { paintPlotBackground } from './paintPlotBackground';
import { setPixel } from './setPixel';
import { visibleFrequencyBins } from './visibleFrequencyBins';

interface DrawOpts {
  title?: string;
  floorDb: number;
  ceilDb: number;
  maxFreqHz?: number;
}

/** Pixels at bin resolution: time across, frequency up (0 Hz at the bottom). */
function spectrogramImage(data: SpectrogramResult, maxBin: number, opts: DrawOpts): ImageData {
  const img = new ImageData(data.timeBins, maxBin + 1);
  const range = opts.ceilDb - opts.floorDb || 1;

  for (let t = 0; t < data.timeBins; t++) {
    const rowBase = t * data.freqBins;

    for (let f = 0; f <= maxBin; f++) {
      const imgY = maxBin - f;
      setPixel(img.data, (imgY * data.timeBins + t) * 4, dbColor(data.magnitudes[rowBase + f]!, opts.floorDb, range));
    }
  }

  return img;
}

/** Time × frequency heatmap with axes and a dB colour bar; returns the geometry the crosshair needs. */
export function drawSpectrogram(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: SpectrogramResult,
  opts: DrawOpts,
): PlotGeom | null {
  paintPlotBackground(ctx, width, height, M, opts.title, 8);
  const plotW = width - M.left - M.right;
  const plotH = height - M.top - M.bottom;
  if (plotW <= 1 || plotH <= 1) return null;

  if (data.timeBins === 0 || data.freqBins === 0) {
    drawPlotMessage(ctx, M, plotW, plotH, 'Not enough samples for spectrogram');

    return null;
  }

  const { maxBin, displayedFMax } = visibleFrequencyBins(data.frequencies, data.freqBins, opts.maxFreqHz);
  drawScaledImage(ctx, spectrogramImage(data, maxBin, opts), M, plotW, plotH, 'high');
  ctx.lineWidth = 1;
  drawPlotFrame(ctx, M, plotW, plotH);

  const tMin = data.times[0] ?? 0;
  const tMax = data.times[data.times.length - 1] ?? 1;
  const axis = { ticks: 6, format: formatTickPrecise };
  drawCanvasXAxis(ctx, M.left, M.top + plotH, plotW, tMin, tMax, 't (s)', { ...axis, labelAt: 'end' });
  drawCanvasYAxis(ctx, M.left, M.top, plotH, 0, displayedFMax, 'Hz', { ...axis, labelOffset: 36 });
  drawColorbar(ctx, width - M.right + 14, M.top, 12, plotH, opts.floorDb, opts.ceilDb);

  return {
    left: M.left,
    top: M.top,
    plotW,
    plotH,
    xMin: tMin,
    xMax: tMax,
    yMin: 0,
    yMax: displayedFMax,
    fmtX: (v) => `${v.toFixed(2)} s`,
    fmtY: (v) => `${v.toFixed(0)} Hz`,
  };
}
