import { BINNED_SPEC_MARGIN as M } from '../constants';
import type { BinnedSpectrogramResult, PlotGeom } from '../types';
import { dbColor } from './dbColor';
import { drawCanvasXAxis } from './drawCanvasXAxis';
import { drawCanvasYAxis } from './drawCanvasYAxis';
import { drawColorbar } from './drawColorbar';
import { drawPlotFrame } from './drawPlotFrame';
import { drawPlotMessage } from './drawPlotMessage';
import { drawScaledImage } from './drawScaledImage';
import { formatTickCompact } from './formatTickCompact';
import { paintPlotBackground } from './paintPlotBackground';
import { setPixel } from './setPixel';
import { visibleFrequencyBins } from './visibleFrequencyBins';

interface DrawOpts {
  title?: string;
  yLabel: string;
  maxFreqHz?: number;
  dbFloor: number;
  dbCeil: number;
  valueUnit: string;
}

/** Pixels at bin resolution: frequency across, domain up (low domain value at the bottom). */
function binnedImage(data: BinnedSpectrogramResult, maxFreqBin: number, opts: DrawOpts): ImageData {
  const visibleFreqBins = maxFreqBin + 1;
  const img = new ImageData(visibleFreqBins, data.xBins);
  const range = opts.dbCeil - opts.dbFloor || 1;

  for (let x = 0; x < data.xBins; x++) {
    const imgY = data.xBins - 1 - x;
    const rowBase = x * data.freqBins;

    for (let f = 0; f <= maxFreqBin; f++) {
      const color = dbColor(data.magnitudes[rowBase + f]!, opts.dbFloor, range);
      setPixel(img.data, (imgY * visibleFreqBins + f) * 4, color);
    }
  }

  return img;
}

/** Domain (Y) range from the bin centres, half a bin past each end. */
function domainRange(centres: Float32Array): { yMin: number; yMax: number } {
  const yStep = centres.length > 1 ? centres[1]! - centres[0]! : 1;

  return {
    yMin: (centres[0] ?? 0) - yStep / 2,
    yMax: (centres[centres.length - 1] ?? 1) + yStep / 2,
  };
}

/** Frequency × domain (throttle or RPM) heatmap with axes and colour bar; returns the crosshair geometry. */
export function drawBinnedSpectrogram(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: BinnedSpectrogramResult,
  opts: DrawOpts,
): PlotGeom | null {
  paintPlotBackground(ctx, width, height, M, opts.title, 6);
  const plotW = width - M.left - M.right;
  const plotH = height - M.top - M.bottom;
  if (plotW <= 1 || plotH <= 1) return null;

  if (data.xBins === 0 || data.freqBins === 0 || data.magnitudes.length === 0) {
    drawPlotMessage(ctx, M, plotW, plotH, 'No coverage for this domain in the window');

    return null;
  }

  const { maxBin, displayedFMax } = visibleFrequencyBins(data.frequencies, data.freqBins, opts.maxFreqHz);
  const { yMin, yMax } = domainRange(data.xCenters);
  drawScaledImage(ctx, binnedImage(data, maxBin, opts), M, plotW, plotH, 'high');
  ctx.lineWidth = 1;
  drawPlotFrame(ctx, M, plotW, plotH);

  const format = formatTickCompact;
  drawCanvasXAxis(ctx, M.left, M.top + plotH, plotW, 0, displayedFMax, 'Hz', { ticks: 8, format, labelAt: 'center' });
  drawCanvasYAxis(ctx, M.left, M.top, plotH, yMin, yMax, opts.yLabel, { ticks: 6, format, labelOffset: 42 });
  drawColorbar(ctx, width - M.right + 16, M.top, 12, plotH, opts.dbFloor, opts.dbCeil, opts.valueUnit);

  return {
    left: M.left,
    top: M.top,
    plotW,
    plotH,
    xMin: 0,
    xMax: displayedFMax,
    yMin,
    yMax,
    fmtX: (v) => `${v.toFixed(0)} Hz`,
    fmtY: opts.yLabel.includes('%') ? (v) => `${v.toFixed(0)}%` : (v) => `${v.toFixed(0)} Hz`,
  };
}
