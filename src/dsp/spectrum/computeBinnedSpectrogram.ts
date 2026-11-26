import type { BinnedSpectrogramOptions, BinnedSpectrogramResult, FftImpl, SpectralValueMode } from '../../types';
import { createFft } from '../../utils/createFft';
import { makeHannWindow } from '../../utils/makeHannWindow';
import { nextPow2 } from '../../utils/nextPow2';
import { accumulateOneSidedPower } from './accumulateOneSidedPower';
import { binFrequencies } from './binFrequencies';
import { fillPeakRelativeDb } from './fillPeakRelativeDb';
import { fillWindowedSegment } from './fillWindowedSegment';
import { flooredDb } from './flooredDb';
import { segmentMean } from './segmentMean';
import { windowPower } from './windowPower';

/** How the domain axis is cut into X bins. */
interface DomainBins {
  xBins: number;
  domainMin: number;
  span: number;
  step: number;
  /** Half-width of the domain range a segment must fall in to count towards a bin. */
  wnd: number;
}

/** Segment length, FFT size, smoothing and value mode. */
interface SegmentSettings {
  segmentLen: number;
  fftSize: number;
  freqBins: number;
  smoothRows: number;
  smoothCols: number;
  mode: SpectralValueMode;
  floorDb: number;
}

/** FFT state and buffers reused for every segment. */
interface SegmentFft {
  fft: FftImpl;
  fftOut: Float64Array;
  buf: Float64Array;
  hann: Float64Array;
  psdNorm: number;
  nyquistBin: number;
  segmentLen: number;
  mode: SpectralValueMode;
}

/**
 * Bin the gyro spectrum by an arbitrary per-sample domain signal (throttle % or
 * motor RPM): split into short segments, FFT each, and average the spectra of
 * all segments whose mean domain value falls near each X bin. Magnitude mode
 * yields dB-relative-to-peak (the classic noise heatmap); PSD mode yields
 * absolute dB so noise-floor levels are directly readable.
 */
export function computeBinnedSpectrogram(
  signal: Float32Array,
  domain: Float32Array,
  sampleRateHz: number,
  options: BinnedSpectrogramOptions = {},
): BinnedSpectrogramResult {
  const bins = domainBins(options);
  const seg = segmentSettings(options, sampleRateHz);
  const { xBins, domainMin, span, step } = bins;
  const { segmentLen, freqBins, mode } = seg;

  const empty = (): BinnedSpectrogramResult => ({
    xCenters: new Float32Array(0),
    frequencies: new Float32Array(0),
    magnitudes: new Float32Array(0),
    freqBins,
    xBins,
    valueMode: mode,
  });

  if (signal.length < segmentLen || domain.length !== signal.length || sampleRateHz <= 0 || span <= 0) {
    return empty();
  }

  const numSegments = Math.floor(signal.length / segmentLen);
  if (numSegments <= 0) return empty();

  // Mean domain value per segment.
  const segMeans = new Float32Array(numSegments);
  for (let i = 0; i < numSegments; i++) segMeans[i] = segmentMean(domain, i * segmentLen, segmentLen);

  const linear = binnedLinearSpectra(signal, segMeans, sampleRateHz, bins, seg);
  const smoothed = boxFilter2D(linear, xBins, freqBins, seg.smoothRows, seg.smoothCols);
  const magnitudes = spectrumDb(smoothed, mode, seg.floorDb);

  const xCenters = new Float32Array(xBins);
  for (let i = 0; i < xBins; i++) xCenters[i] = domainMin + (i + 0.5) * step;
  const frequencies = binFrequencies(freqBins, sampleRateHz, seg.fftSize);

  return { xCenters, frequencies, magnitudes, freqBins, xBins, valueMode: mode };
}

/** Smoothed linear spectra to dB: absolute PSD, or magnitude relative to the overall peak. */
function spectrumDb(smoothed: Float32Array, mode: SpectralValueMode, floorDb: number): Float32Array {
  const magnitudes = new Float32Array(smoothed.length);

  if (mode === 'psd') {
    // Absolute PSD in dB (mean power/Hz per bin).
    for (let i = 0; i < smoothed.length; i++) magnitudes[i] = flooredDb(smoothed[i]!, 10, floorDb);
  } else {
    // Magnitude in dB relative to overall peak.
    let peak = 0;
    for (let i = 0; i < smoothed.length; i++) if (smoothed[i]! > peak) peak = smoothed[i]!;
    fillPeakRelativeDb(magnitudes, smoothed, peak, floorDb);
  }

  return magnitudes;
}

function domainBins(options: BinnedSpectrogramOptions): DomainBins {
  const xBins = options.bins ?? 100;
  const domainMin = options.domainMin ?? 0;
  const domainMax = options.domainMax ?? 100;

  const span = domainMax - domainMin;
  const step = span > 0 ? span / xBins : 1;
  const wnd = options.domainWindow ?? Math.max(step, span * 0.06);

  return { xBins, domainMin, span, step, wnd };
}

function segmentSettings(options: BinnedSpectrogramOptions, sampleRateHz: number): SegmentSettings {
  const segmentSec = options.segmentSec ?? 0.2;
  const smoothRows = options.smoothRows ?? 8;
  const mode: SpectralValueMode = options.mode ?? 'magnitude';
  const floorDb = options.floorDb ?? (mode === 'psd' ? -200 : -80);

  const segmentLen = Math.max(8, Math.round(sampleRateHz * segmentSec));
  const fftSize = nextPow2(segmentLen);
  const freqBins = (fftSize >> 1) + 1;
  const smoothCols = options.smoothCols ?? Math.max(1, Math.round(segmentLen / 100));

  return { segmentLen, fftSize, freqBins, smoothRows, smoothCols, mode, floorDb };
}

/** Mean linear spectrum per X bin (row-major, `xBins × freqBins`); bins without segments stay 0. */
function binnedLinearSpectra(
  signal: Float32Array,
  segMeans: Float32Array,
  sampleRateHz: number,
  bins: DomainBins,
  seg: SegmentSettings,
): Float32Array {
  const { xBins, domainMin, step, wnd } = bins;
  const { segmentLen, fftSize, freqBins } = seg;

  const hann = makeHannWindow(segmentLen);
  const ctx: SegmentFft = {
    fft: createFft(fftSize),
    fftOut: new Float64Array(fftSize * 2),
    buf: new Float64Array(fftSize),
    hann,
    psdNorm: 1 / (sampleRateHz * windowPower(hann)),
    nyquistBin: fftSize >> 1,
    segmentLen,
    mode: seg.mode,
  };

  const linear = new Float32Array(xBins * freqBins);
  const accum = new Float64Array(freqBins);

  for (let xbin = 0; xbin < xBins; xbin++) {
    const center = domainMin + (xbin + 0.5) * step;
    const lo = center - wnd;
    const hi = center + wnd;

    accum.fill(0);
    let n = 0;

    for (let s = 0; s < segMeans.length; s++) {
      const m = segMeans[s]!;
      if (!(m > lo && m <= hi)) continue;

      accumulateSegmentSpectrum(accum, signal, s * segmentLen, ctx);
      n++;
    }

    if (n > 0) {
      const inv = 1 / n;
      const base = xbin * freqBins;
      for (let f = 0; f < freqBins; f++) linear[base + f] = accum[f]! * inv;
    }
  }

  return linear;
}

/** FFT one segment and add its one-sided PSD (psd mode) or |X| / N (magnitude mode) to `accum`. */
function accumulateSegmentSpectrum(accum: Float64Array, signal: Float32Array, segStart: number, ctx: SegmentFft): void {
  const { fft, fftOut, buf } = ctx;
  buf.fill(0);
  fillWindowedSegment(buf, signal, segStart, ctx.hann);
  fft.realTransform(fftOut, buf);

  if (ctx.mode === 'psd') {
    accumulateOneSidedPower(accum, fftOut, ctx.psdNorm, ctx.nyquistBin);

    return;
  }

  const norm = 1 / ctx.segmentLen;

  for (let f = 0; f < accum.length; f++) {
    const re = fftOut[2 * f]!;
    const im = fftOut[2 * f + 1]!;
    accum[f] = accum[f]! + Math.sqrt(re * re + im * im) * norm;
  }
}

function boxFilter2D(mat: Float32Array, rows: number, cols: number, kRows: number, kCols: number): Float32Array {
  if (kRows <= 1 && kCols <= 1) return mat.slice();
  // Horizontal pass.
  const tmp = horizontalBoxPass(mat, rows, cols, Math.floor(kCols / 2));

  // Vertical pass.
  return verticalBoxPass(tmp, rows, cols, Math.floor(kRows / 2));
}

function horizontalBoxPass(mat: Float32Array, rows: number, cols: number, halfC: number): Float32Array {
  const tmp = new Float32Array(rows * cols);

  for (let r = 0; r < rows; r++) {
    const base = r * cols;

    for (let c = 0; c < cols; c++) {
      let sum = 0;
      let n = 0;
      const k0 = Math.max(0, c - halfC);
      const k1 = Math.min(cols - 1, c + halfC);

      for (let k = k0; k <= k1; k++) {
        sum += mat[base + k]!;
        n++;
      }

      tmp[base + c] = n > 0 ? sum / n : 0;
    }
  }

  return tmp;
}

function verticalBoxPass(tmp: Float32Array, rows: number, cols: number, halfR: number): Float32Array {
  const out = new Float32Array(rows * cols);

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      let sum = 0;
      let n = 0;
      const k0 = Math.max(0, r - halfR);
      const k1 = Math.min(rows - 1, r + halfR);

      for (let k = k0; k <= k1; k++) {
        sum += tmp[k * cols + c]!;
        n++;
      }

      out[r * cols + c] = n > 0 ? sum / n : 0;
    }
  }

  return out;
}
