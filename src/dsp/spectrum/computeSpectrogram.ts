import type { SpectralValueMode, SpectrogramOptions, SpectrogramResult } from '../../types';
import { createFft } from '../../utils/createFft';
import { makeHannWindow } from '../../utils/makeHannWindow';
import { binFrequencies } from './binFrequencies';
import { fillPeakRelativeDb } from './fillPeakRelativeDb';
import { fillWindowedSegment } from './fillWindowedSegment';
import { flooredDb } from './flooredDb';
import { windowPower } from './windowPower';

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
  const { windowSize, hopSize, mode, floorDb } = spectrogramSettings(options);
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
  const { linear, peak } = stftMagnitudes(signal, windowSize, hopSize, timeBins);
  const magnitudes = new Float32Array(linear.length);

  if (mode === 'psd') {
    fillPsdDb(magnitudes, linear, sampleRateHz, windowSize, floorDb);
  } else {
    // Magnitude in dB relative to peak; floor at floorDb.
    fillPeakRelativeDb(magnitudes, linear, peak, floorDb);
  }

  return {
    times: windowCentreTimes(timeBins, windowSize, hopSize, sampleRateHz),
    frequencies: binFrequencies(freqBins, sampleRateHz, windowSize),
    magnitudes,
    freqBins,
    timeBins,
    peakMagnitude: peak,
    valueMode: mode,
  };
}

function spectrogramSettings(options: SpectrogramOptions): {
  windowSize: number;
  hopSize: number;
  mode: SpectralValueMode;
  floorDb: number;
} {
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

  return { windowSize, hopSize, mode, floorDb };
}

/** Raw |X| per time bin (row-major, `timeBins × freqBins`) and the largest one. */
function stftMagnitudes(
  signal: Float32Array,
  windowSize: number,
  hopSize: number,
  timeBins: number,
): { linear: Float32Array; peak: number } {
  const freqBins = (windowSize >> 1) + 1;
  const hann = makeHannWindow(windowSize);
  const fft = createFft(windowSize);
  const fftOut = new Float64Array(windowSize * 2); // [re0, im0, re1, im1, ...]
  const windowed = new Float64Array(windowSize);

  // Magnitudes stored as raw (linear) first; we convert to dB below after the peak is known.
  const linear = new Float32Array(timeBins * freqBins);
  let peak = 0;

  for (let t = 0; t < timeBins; t++) {
    fillWindowedSegment(windowed, signal, t * hopSize, hann);
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

  return { linear, peak };
}

/**
 * Absolute one-sided PSD in dB (power per Hz). `linear` holds raw |X|, so
 * power = |X|^2 scaled by the window energy, doubled off the DC/Nyquist bins.
 */
function fillPsdDb(
  out: Float32Array,
  linear: Float32Array,
  sampleRateHz: number,
  windowSize: number,
  floorDb: number,
): void {
  const freqBins = (windowSize >> 1) + 1;
  const psdNorm = 1 / (sampleRateHz * windowPower(makeHannWindow(windowSize)));
  const nyquistBin = windowSize >> 1;

  for (let i = 0; i < linear.length; i++) {
    const f = i % freqBins;
    const mag = linear[i]!;
    const factor = f === 0 || f === nyquistBin ? 1 : 2;
    out[i] = flooredDb(mag * mag * psdNorm * factor, 10, floorDb);
  }
}

/** Bin time = (center of window) / sampleRate. */
function windowCentreTimes(timeBins: number, windowSize: number, hopSize: number, sampleRateHz: number): Float32Array {
  const times = new Float32Array(timeBins);
  const halfWindowSec = windowSize / (2 * sampleRateHz);
  const hopSec = hopSize / sampleRateHz;
  for (let t = 0; t < timeBins; t++) times[t] = halfWindowSec + t * hopSec;

  return times;
}
