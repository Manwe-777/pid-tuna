import type { PsdOptions, PsdResult } from '../../types';
import { createFft } from '../../utils/createFft';
import { makeHannWindow } from '../../utils/makeHannWindow';
import { segmentMean } from './segmentMean';

/**
 * Welch's-method PSD: overlapping Hann-windowed segments, FFT each, average
 * the squared magnitudes (one-sided, scaled for window-power normalization),
 * convert to dB. Returns absolute dB (not normalized to peak) so traces from
 * different signals can be compared on the same axis.
 */
export function computePsd(signal: Float32Array, sampleRateHz: number, options: PsdOptions = {}): PsdResult {
  const windowSize = options.windowSize ?? 1024;
  const overlap = options.overlap ?? 0.5;
  const floorDb = options.floorDb ?? -200;

  if ((windowSize & (windowSize - 1)) !== 0 || windowSize < 2) {
    throw new Error(`PSD windowSize must be a power of two >= 2 (got ${windowSize})`);
  }
  const hopSize = Math.max(1, Math.floor(windowSize * (1 - overlap)));
  const freqBins = (windowSize >> 1) + 1;

  if (signal.length < windowSize || sampleRateHz <= 0) {
    return {
      frequencies: new Float32Array(freqBins),
      psdDb: new Float32Array(freqBins),
      numWindows: 0,
    };
  }

  const hann = makeHannWindow(windowSize);
  // Window-power normalization for one-sided PSD.
  let winSqSum = 0;
  for (let i = 0; i < windowSize; i++) winSqSum += hann[i]! * hann[i]!;
  const psdNorm = 1 / (sampleRateHz * winSqSum);

  const fft = createFft(windowSize);
  const fftOut = new Float64Array(windowSize * 2);
  const buf = new Float64Array(windowSize);

  const numWindows = Math.floor((signal.length - windowSize) / hopSize) + 1;
  const accum = new Float64Array(freqBins);
  const nyquistBin = windowSize >> 1;

  for (let w = 0; w < numWindows; w++) {
    const start = w * hopSize;
    const mean = segmentMean(signal, start, windowSize);
    for (let i = 0; i < windowSize; i++) buf[i] = (signal[start + i]! - mean) * hann[i]!;
    fft.realTransform(fftOut, buf);

    for (let f = 0; f < freqBins; f++) {
      const re = fftOut[2 * f]!;
      const im = fftOut[2 * f + 1]!;
      const power = (re * re + im * im) * psdNorm;
      // One-sided: bin 0 and Nyquist counted once, all others doubled.
      const factor = f === 0 || f === nyquistBin ? 1 : 2;
      accum[f] = accum[f]! + power * factor;
    }
  }

  const inv = 1 / numWindows;
  const psdDb = new Float32Array(freqBins);
  for (let f = 0; f < freqBins; f++) {
    const p = accum[f]! * inv;
    const db = p > 0 ? 10 * Math.log10(p) : floorDb;
    psdDb[f] = db < floorDb ? floorDb : db;
  }

  const frequencies = new Float32Array(freqBins);
  const fStep = sampleRateHz / windowSize;
  for (let f = 0; f < freqBins; f++) frequencies[f] = f * fStep;

  return { frequencies, psdDb, numWindows };
}
