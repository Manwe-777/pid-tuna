import type { BinnedSpectrogramOptions, BinnedSpectrogramResult, SpectralValueMode } from '../../types';
import { createFft } from '../../utils/createFft';
import { makeHannWindow } from '../../utils/makeHannWindow';
import { nextPow2 } from '../../utils/nextPow2';
import { segmentMean } from './segmentMean';

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
  const xBins = options.bins ?? 100;
  const domainMin = options.domainMin ?? 0;
  const domainMax = options.domainMax ?? 100;
  const segmentSec = options.segmentSec ?? 0.2;
  const smoothRows = options.smoothRows ?? 8;
  const mode: SpectralValueMode = options.mode ?? 'magnitude';
  const floorDb = options.floorDb ?? (mode === 'psd' ? -200 : -80);

  const span = domainMax - domainMin;
  const step = span > 0 ? span / xBins : 1;
  const wnd = options.domainWindow ?? Math.max(step, span * 0.06);

  const segmentLen = Math.max(8, Math.round(sampleRateHz * segmentSec));
  const fftSize = nextPow2(segmentLen);
  const freqBins = (fftSize >> 1) + 1;
  const smoothCols = options.smoothCols ?? Math.max(1, Math.round(segmentLen / 100));

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
  for (let i = 0; i < numSegments; i++) {
    let sum = 0;
    const s = i * segmentLen;
    for (let k = 0; k < segmentLen; k++) sum += domain[s + k]!;
    segMeans[i] = sum / segmentLen;
  }

  const hann = makeHannWindow(segmentLen);
  let winSqSum = 0;
  for (let i = 0; i < segmentLen; i++) winSqSum += hann[i]! * hann[i]!;
  const psdNorm = 1 / (sampleRateHz * winSqSum);
  const nyquistBin = fftSize >> 1;

  const fft = createFft(fftSize);
  const fftOut = new Float64Array(fftSize * 2);
  const buf = new Float64Array(fftSize);

  const linear = new Float32Array(xBins * freqBins);
  const accum = new Float64Array(freqBins);

  for (let xbin = 0; xbin < xBins; xbin++) {
    const center = domainMin + (xbin + 0.5) * step;
    const lo = center - wnd;
    const hi = center + wnd;

    accum.fill(0);
    let n = 0;

    for (let s = 0; s < numSegments; s++) {
      const m = segMeans[s]!;
      if (!(m > lo && m <= hi)) continue;

      const segStart = s * segmentLen;
      const mean = segmentMean(signal, segStart, segmentLen);
      buf.fill(0);
      for (let k = 0; k < segmentLen; k++) {
        buf[k] = (signal[segStart + k]! - mean) * hann[k]!;
      }
      fft.realTransform(fftOut, buf);

      if (mode === 'psd') {
        for (let f = 0; f < freqBins; f++) {
          const re = fftOut[2 * f]!;
          const im = fftOut[2 * f + 1]!;
          const factor = f === 0 || f === nyquistBin ? 1 : 2;
          accum[f] = accum[f]! + (re * re + im * im) * psdNorm * factor;
        }
      } else {
        const norm = 1 / segmentLen;
        for (let f = 0; f < freqBins; f++) {
          const re = fftOut[2 * f]!;
          const im = fftOut[2 * f + 1]!;
          accum[f] = accum[f]! + Math.sqrt(re * re + im * im) * norm;
        }
      }
      n++;
    }

    if (n > 0) {
      const inv = 1 / n;
      const base = xbin * freqBins;
      for (let f = 0; f < freqBins; f++) linear[base + f] = accum[f]! * inv;
    }
  }

  const smoothed = boxFilter2D(linear, xBins, freqBins, smoothRows, smoothCols);

  const magnitudes = new Float32Array(smoothed.length);
  if (mode === 'psd') {
    // Absolute PSD in dB (mean power/Hz per bin).
    for (let i = 0; i < smoothed.length; i++) {
      const p = smoothed[i]!;
      const db = p > 0 ? 10 * Math.log10(p) : floorDb;
      magnitudes[i] = db < floorDb ? floorDb : db;
    }
  } else {
    // Magnitude in dB relative to overall peak.
    let peak = 0;
    for (let i = 0; i < smoothed.length; i++) if (smoothed[i]! > peak) peak = smoothed[i]!;
    if (peak > 0) {
      const invPeak = 1 / peak;
      for (let i = 0; i < smoothed.length; i++) {
        const v = smoothed[i]! * invPeak;
        const db = v > 0 ? 20 * Math.log10(v) : floorDb;
        magnitudes[i] = db < floorDb ? floorDb : db;
      }
    }
  }

  const xCenters = new Float32Array(xBins);
  for (let i = 0; i < xBins; i++) xCenters[i] = domainMin + (i + 0.5) * step;
  const frequencies = new Float32Array(freqBins);
  const fStep = sampleRateHz / fftSize;
  for (let i = 0; i < freqBins; i++) frequencies[i] = i * fStep;

  return { xCenters, frequencies, magnitudes, freqBins, xBins, valueMode: mode };
}

function boxFilter2D(mat: Float32Array, rows: number, cols: number, kRows: number, kCols: number): Float32Array {
  if (kRows <= 1 && kCols <= 1) return mat.slice();
  const tmp = new Float32Array(rows * cols);
  // Horizontal pass.
  const halfC = Math.floor(kCols / 2);
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
  // Vertical pass.
  const out = new Float32Array(rows * cols);
  const halfR = Math.floor(kRows / 2);
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
