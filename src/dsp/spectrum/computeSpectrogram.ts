import type { SpectralValueMode, SpectrogramOptions, SpectrogramResult } from '../../types';
import { createFft } from '../../utils/createFft';
import { makeHannWindow } from '../../utils/makeHannWindow';
import { segmentMean } from './segmentMean';

const DEFAULT_WINDOW_SIZE = 512;

const DEFAULT_FLOOR_DB = -80;

/**
 * STFT magnitude spectrogram with a Hann window. Returns magnitudes in dB
 * relative to the peak magnitude in the whole spectrogram, so 0 dB = loudest
 * bin and values flow downward.
 */
export function computeSpectrogram(
  signal: Float32Array,
  sampleRateHz: number,
  options: SpectrogramOptions = {},
): SpectrogramResult {
  const windowSize = options.windowSize ?? DEFAULT_WINDOW_SIZE;
  const hopSize = options.hopSize ?? windowSize >> 1;
  const mode: SpectralValueMode = options.mode ?? 'magnitude';
  const floorDb = options.floorDb ?? (mode === 'psd' ? -200 : DEFAULT_FLOOR_DB);

  if ((windowSize & (windowSize - 1)) !== 0 || windowSize < 2) {
    throw new Error(`Spectrogram windowSize must be a power of two >= 2 (got ${windowSize})`);
  }
  if (hopSize < 1) {
    throw new Error(`Spectrogram hopSize must be >= 1 (got ${hopSize})`);
  }

  const freqBins = (windowSize >> 1) + 1;
  if (signal.length < windowSize || sampleRateHz <= 0) {
    return {
      times: new Float32Array(0),
      frequencies: new Float32Array(0),
      magnitudes: new Float32Array(0),
      freqBins,
      timeBins: 0,
      peakMagnitude: 0,
      valueMode: mode,
    };
  }

  const timeBins = Math.floor((signal.length - windowSize) / hopSize) + 1;
  const hann = makeHannWindow(windowSize);
  const fft = createFft(windowSize);
  const fftOut = new Float64Array(windowSize * 2); // [re0, im0, re1, im1, ...]
  const windowed = new Float64Array(windowSize);

  // Magnitudes stored as raw (linear) first; we convert to dB below after the peak is known.
  const linear = new Float32Array(timeBins * freqBins);
  let peak = 0;

  for (let t = 0; t < timeBins; t++) {
    const start = t * hopSize;
    const mean = segmentMean(signal, start, windowSize);
    for (let i = 0; i < windowSize; i++) {
      windowed[i] = (signal[start + i]! - mean) * hann[i]!;
    }
    fft.realTransform(fftOut, windowed);

    const rowBase = t * freqBins;
    for (let f = 0; f < freqBins; f++) {
      const re = fftOut[2 * f]!;
      const im = fftOut[2 * f + 1]!;
      const mag = Math.sqrt(re * re + im * im);
      linear[rowBase + f] = mag;
      if (mag > peak) peak = mag;
    }
  }

  const magnitudes = new Float32Array(linear.length);
  if (mode === 'psd') {
    // Absolute one-sided PSD in dB (power per Hz). `linear` holds raw |X|, so
    // power = |X|^2 scaled by the window energy, doubled off the DC/Nyquist bins.
    const hann = makeHannWindow(windowSize);
    let winSqSum = 0;
    for (let i = 0; i < windowSize; i++) winSqSum += hann[i]! * hann[i]!;
    const psdNorm = 1 / (sampleRateHz * winSqSum);
    const nyquistBin = windowSize >> 1;
    for (let t = 0; t < timeBins; t++) {
      const rowBase = t * freqBins;
      for (let f = 0; f < freqBins; f++) {
        const mag = linear[rowBase + f]!;
        const factor = f === 0 || f === nyquistBin ? 1 : 2;
        const power = mag * mag * psdNorm * factor;
        const db = power > 0 ? 10 * Math.log10(power) : floorDb;
        magnitudes[rowBase + f] = db < floorDb ? floorDb : db;
      }
    }
  } else if (peak > 0) {
    // Magnitude in dB relative to peak; floor at floorDb.
    const invPeak = 1 / peak;
    for (let i = 0; i < linear.length; i++) {
      const norm = linear[i]! * invPeak;
      // 20*log10(norm); guard against 0 → -Infinity.
      const db = norm > 0 ? 20 * Math.log10(norm) : floorDb;
      magnitudes[i] = db < floorDb ? floorDb : db;
    }
  }

  // Bin time = (center of window) / sampleRate.
  const times = new Float32Array(timeBins);
  const halfWindowSec = windowSize / (2 * sampleRateHz);
  const hopSec = hopSize / sampleRateHz;
  for (let t = 0; t < timeBins; t++) times[t] = halfWindowSec + t * hopSec;

  const frequencies = new Float32Array(freqBins);
  const fStep = sampleRateHz / windowSize;
  for (let f = 0; f < freqBins; f++) frequencies[f] = f * fStep;

  return {
    times,
    frequencies,
    magnitudes,
    freqBins,
    timeBins,
    peakMagnitude: peak,
    valueMode: mode,
  };
}
