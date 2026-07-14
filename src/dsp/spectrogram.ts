import FFT from 'fft.js';

interface FFTImpl {
  size: number;
  createComplexArray(): number[];
  realTransform(out: number[] | Float64Array, data: ArrayLike<number>): void;
}

/**
 * `magnitude` — amplitude spectrum in dB relative to the spectrogram's peak
 * (0 dB = loudest bin, values flow downward). This is the classic view.
 * `psd` — one-sided power-spectral-density in *absolute* dB (10·log10 of
 * power/Hz), not peak-normalized, so the noise floor can be read directly and
 * compared across logs / throttle / RPM. Callers should colour PSD heatmaps
 * against the data's own min/max rather than assuming a 0 dB ceiling.
 */
export type SpectralValueMode = 'magnitude' | 'psd';

export interface SpectrogramOptions {
  /** FFT window length (samples). Must be a power of two. Default 512. */
  windowSize?: number;
  /** Hop length (samples). Default = windowSize / 2 (50% overlap). */
  hopSize?: number;
  /** Floor magnitudes below this in dB. Default -80 (magnitude) / -200 (psd). */
  floorDb?: number;
  /** Amplitude (default) vs power-spectral-density scaling. */
  mode?: SpectralValueMode;
}

export interface SpectrogramResult {
  /** Time of each window center, in seconds. */
  times: Float32Array;
  /** Frequency of each bin, in Hz. Length = freqBins. */
  frequencies: Float32Array;
  /** Values in dB, indexed [t * freqBins + f]. Magnitude mode: relative to peak,
   *  floored to floorDb. PSD mode: absolute dB. */
  magnitudes: Float32Array;
  freqBins: number;
  timeBins: number;
  /** Peak magnitude (in linear units) used as the 0 dB reference (magnitude mode). */
  peakMagnitude: number;
  /** Which scaling was used. */
  valueMode: SpectralValueMode;
}

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
  const fft = new (FFT as unknown as new (size: number) => FFTImpl)(windowSize);
  const fftOut = new Float64Array(windowSize * 2); // [re0, im0, re1, im1, ...]
  const windowed = new Float64Array(windowSize);

  // Magnitudes stored as raw (linear) first; we convert to dB below after the peak is known.
  const linear = new Float32Array(timeBins * freqBins);
  let peak = 0;

  for (let t = 0; t < timeBins; t++) {
    const start = t * hopSize;
    for (let i = 0; i < windowSize; i++) {
      windowed[i] = signal[start + i]! * hann[i]!;
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

function makeHannWindow(n: number): Float32Array {
  const w = new Float32Array(n);
  const k = (2 * Math.PI) / (n - 1);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos(k * i);
  return w;
}

function nextPow2(n: number): number {
  if (n <= 1) return 2;
  return 1 << Math.ceil(Math.log2(n));
}

/* ------------------------------------------------------------------ */
/* 2D binned (domain-vs-frequency) spectrogram (port of PTthrSpec.m,   */
/* generalized so the X domain can be throttle % or motor RPM).        */
/* ------------------------------------------------------------------ */

export interface BinnedSpectrogramOptions {
  /** Number of domain (X) bins (default 100). */
  bins?: number;
  /** Lower domain edge (default 0). */
  domainMin?: number;
  /** Upper domain edge (default 100 — suits throttle %). */
  domainMax?: number;
  /** Domain smoothing window in domain units: segments within ±window of a bin
   *  center contribute to that bin. Default = 6% of the domain span. */
  domainWindow?: number;
  /** Segment length in seconds (default 0.2 s, matches PTthrSpec). */
  segmentSec?: number;
  /** dB floor (default -80 magnitude / -200 psd). */
  floorDb?: number;
  /** Domain-axis box-filter row count (default 8). */
  smoothRows?: number;
  /** Frequency box-filter col count; default derived from segment length. */
  smoothCols?: number;
  /** Amplitude (default) vs power-spectral-density scaling. */
  mode?: SpectralValueMode;
}

export interface BinnedSpectrogramResult {
  /** Domain (X) bin centers. Length = xBins. */
  xCenters: Float32Array;
  /** Frequency bin centers (Hz). Length = freqBins. */
  frequencies: Float32Array;
  /** dB values, indexed [xBin * freqBins + freqBin]. Magnitude: relative to
   *  peak, floored. PSD: absolute dB. */
  magnitudes: Float32Array;
  freqBins: number;
  xBins: number;
  valueMode: SpectralValueMode;
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

  if (
    signal.length < segmentLen ||
    domain.length !== signal.length ||
    sampleRateHz <= 0 ||
    span <= 0
  ) {
    return empty();
  }

  const numSegments = Math.floor(signal.length / segmentLen) - 1;
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

  const fft = new (FFT as unknown as new (size: number) => FFTImpl)(fftSize);
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
      buf.fill(0);
      for (let k = 0; k < segmentLen; k++) {
        buf[k] = signal[segStart + k]! * hann[k]!;
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

/* ------------------------------------------------------------------ */
/* 1D PSD via Welch's method.                                          */
/* ------------------------------------------------------------------ */

export interface PsdOptions {
  /** FFT window length (samples). Must be power of two. Default 1024. */
  windowSize?: number;
  /** Window overlap fraction (0-1). Default 0.5. */
  overlap?: number;
  /** dB floor; values below this clipped (default -200 to preserve headroom). */
  floorDb?: number;
}

export interface PsdResult {
  /** Frequency bin centers (Hz). Length = freqBins. */
  frequencies: Float32Array;
  /** Power-spectral-density in dB (10*log10 of power/Hz). Length = freqBins. */
  psdDb: Float32Array;
  /** Number of windows averaged. 0 means signal too short. */
  numWindows: number;
}

/**
 * Welch's-method PSD: overlapping Hann-windowed segments, FFT each, average
 * the squared magnitudes (one-sided, scaled for window-power normalization),
 * convert to dB. Returns absolute dB (not normalized to peak) so traces from
 * different signals can be compared on the same axis.
 */
export function computePsd(
  signal: Float32Array,
  sampleRateHz: number,
  options: PsdOptions = {},
): PsdResult {
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

  const fft = new (FFT as unknown as new (size: number) => FFTImpl)(windowSize);
  const fftOut = new Float64Array(windowSize * 2);
  const buf = new Float64Array(windowSize);

  const numWindows = Math.floor((signal.length - windowSize) / hopSize) + 1;
  const accum = new Float64Array(freqBins);
  const nyquistBin = windowSize >> 1;

  for (let w = 0; w < numWindows; w++) {
    const start = w * hopSize;
    for (let i = 0; i < windowSize; i++) buf[i] = signal[start + i]! * hann[i]!;
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

/**
 * Pool multiple Welch PSDs into one. Averages in *linear* power weighted by
 * each input's window count (proper Welch combining), then converts back to
 * dB. PSDs with a different number of frequency bins than the first non-empty
 * result are skipped — those would have been produced with a different FFT
 * size or sample rate and can't be averaged without resampling.
 */
export function combinePsds(results: PsdResult[], floorDb = -200): PsdResult {
  if (results.length === 0) {
    return { frequencies: new Float32Array(), psdDb: new Float32Array(), numWindows: 0 };
  }
  if (results.length === 1) return results[0]!;

  const ref = results.find((r) => r.psdDb.length > 0 && r.numWindows > 0) ?? results[0]!;
  const bins = ref.frequencies.length;
  if (bins === 0) return ref;

  const accum = new Float64Array(bins);
  let totalWindows = 0;
  for (const r of results) {
    if (r.psdDb.length !== bins || r.numWindows <= 0) continue;
    const w = r.numWindows;
    for (let f = 0; f < bins; f++) {
      accum[f] = accum[f]! + Math.pow(10, r.psdDb[f]! / 10) * w;
    }
    totalWindows += w;
  }
  if (totalWindows === 0) return ref;

  const psdDb = new Float32Array(bins);
  const inv = 1 / totalWindows;
  for (let f = 0; f < bins; f++) {
    const lin = accum[f]! * inv;
    const db = lin > 0 ? 10 * Math.log10(lin) : floorDb;
    psdDb[f] = db < floorDb ? floorDb : db;
  }
  return { frequencies: ref.frequencies, psdDb, numWindows: totalWindows };
}

function boxFilter2D(
  mat: Float32Array,
  rows: number,
  cols: number,
  kRows: number,
  kCols: number,
): Float32Array {
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
