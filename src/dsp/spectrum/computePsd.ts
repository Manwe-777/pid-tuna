import type { PsdOptions, PsdResult } from '../../types';
import { createFft } from '../../utils/createFft';
import { makeHannWindow } from '../../utils/makeHannWindow';
import { accumulateOneSidedPower } from './accumulateOneSidedPower';
import { binFrequencies } from './binFrequencies';
import { fillWindowedSegment } from './fillWindowedSegment';
import { flooredDb } from './flooredDb';
import { windowPower } from './windowPower';

/**
 * Welch's-method PSD: overlapping Hann-windowed segments, FFT each, average
 * the squared magnitudes (one-sided, scaled for window-power normalization),
 * convert to dB. Returns absolute dB (not normalized to peak) so traces from
 * different signals can be compared on the same axis.
 */
export function computePsd(signal: Float32Array, sampleRateHz: number, options: PsdOptions = {}): PsdResult {
  const { windowSize, hopSize, floorDb } = psdSettings(options);
  const freqBins = (windowSize >> 1) + 1;

  if (signal.length < windowSize || sampleRateHz <= 0) {
    return {
      frequencies: new Float32Array(freqBins),
      psdDb: new Float32Array(freqBins),
      numWindows: 0,
    };
  }

  const numWindows = Math.floor((signal.length - windowSize) / hopSize) + 1;
  const accum = welchPowerSum(signal, sampleRateHz, windowSize, hopSize, numWindows);

  const inv = 1 / numWindows;
  const psdDb = new Float32Array(freqBins);
  for (let f = 0; f < freqBins; f++) psdDb[f] = flooredDb(accum[f]! * inv, 10, floorDb);

  return { frequencies: binFrequencies(freqBins, sampleRateHz, windowSize), psdDb, numWindows };
}

function psdSettings(options: PsdOptions): { windowSize: number; hopSize: number; floorDb: number } {
  const windowSize = options.windowSize ?? 1024;
  const overlap = options.overlap ?? 0.5;
  const floorDb = options.floorDb ?? -200;

  if ((windowSize & (windowSize - 1)) !== 0 || windowSize < 2) {
    throw new Error(`PSD windowSize must be a power of two >= 2 (got ${windowSize})`);
  }

  const hopSize = Math.max(1, Math.floor(windowSize * (1 - overlap)));

  return { windowSize, hopSize, floorDb };
}

/** Σ one-sided power over `numWindows` Hann-windowed segments `hopSize` apart. */
function welchPowerSum(
  signal: Float32Array,
  sampleRateHz: number,
  windowSize: number,
  hopSize: number,
  numWindows: number,
): Float64Array {
  const hann = makeHannWindow(windowSize);
  // Window-power normalization for one-sided PSD.
  const psdNorm = 1 / (sampleRateHz * windowPower(hann));

  const fft = createFft(windowSize);
  const fftOut = new Float64Array(windowSize * 2);
  const buf = new Float64Array(windowSize);
  const accum = new Float64Array((windowSize >> 1) + 1);
  const nyquistBin = windowSize >> 1;

  for (let w = 0; w < numWindows; w++) {
    fillWindowedSegment(buf, signal, w * hopSize, hann);
    fft.realTransform(fftOut, buf);
    accumulateOneSidedPower(accum, fftOut, psdNorm, nyquistBin);
  }

  return accum;
}
