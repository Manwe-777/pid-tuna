import { createFft } from '../utils/createFft';

export interface HarmonicNoise {
  /** 1 = motor fundamental, 2 = second harmonic, … */
  harmonic: number;
  /** Mean PSD at the harmonic across segments, dB (power per Hz). */
  meanDb: number | null;
  sdDb: number | null;
  /** Segments that had a usable motor frequency. */
  segments: number;
}

export interface HarmonicNoiseOptions {
  harmonics?: number;
  /** Search ± this many Hz around each harmonic for its peak. Default 20. */
  searchHz?: number;
  /** Segment length, s. Default 0.3. */
  segmentSec?: number;
  /** Box smoothing of each segment's PSD, in bins. Default 5. */
  smoothBins?: number;
}

/**
 * Noise left at each multiple of motor speed, the way PIDtoolbox's Motor
 * Harmonic plot measures it: short Hann-windowed segments (50% overlap), one
 * PSD each; in every segment each motor's mean frequency × h marks a bin, and
 * the ±searchHz offset where the motors' bins are loudest on average is that
 * segment's level. The result is the mean ± SD over segments. PSD here is
 * normalised by window power, so it reads about 4.3 dB above PIDtoolbox's,
 * which divides by window length.
 */
export function motorHarmonicNoise(
  signal: Float32Array,
  motorHz: ReadonlyArray<Float32Array>,
  sampleRateHz: number,
  options: HarmonicNoiseOptions = {},
): HarmonicNoise[] {
  const harmonics = options.harmonics ?? 3;
  const searchHz = options.searchHz ?? 20;
  const smoothBins = options.smoothBins ?? 5;
  const segLen = Math.max(16, Math.round(sampleRateHz * (options.segmentSec ?? 0.3)));
  const hop = Math.max(1, Math.round(segLen / 2));
  const empty = Array.from({ length: harmonics }, (_, i) => ({
    harmonic: i + 1,
    meanDb: null,
    sdDb: null,
    segments: 0,
  }));
  if (signal.length < segLen || motorHz.length === 0 || sampleRateHz <= 0) return empty;

  let size = 1;
  while (size < segLen) size <<= 1;

  const fft = createFft(size);
  const hann = Float64Array.from({ length: segLen }, (_, i) => 0.5 * (1 - Math.cos((2 * Math.PI * i) / (segLen - 1))));
  const winPower = hann.reduce((a, w) => a + w * w, 0);
  const binHz = sampleRateHz / size;
  const bins = size / 2 + 1;
  const search = Math.floor(searchHz / binHz);
  const nyquist = sampleRateHz / 2;
  const buf = new Float64Array(size);
  const out = new Float64Array(size * 2);
  const levels: number[][] = Array.from({ length: harmonics }, () => []);

  for (let start = 0; start + segLen <= signal.length; start += hop) {
    const centres = motorHz.map((m) => meanSpinning(m, start, segLen));
    if (centres.every((c) => c == null)) continue;

    buf.fill(0);
    for (let i = 0; i < segLen; i++) buf[i] = signal[start + i]! * hann[i]!;
    fft.realTransform(out, buf);
    const psd = smooth(psdDb(out, bins, sampleRateHz * winPower), smoothBins);

    for (let h = 1; h <= harmonics; h++) {
      const centreBins = centres
        .filter((c): c is number => c != null && c * h + searchHz <= nyquist)
        .map((c) => Math.round((c * h) / binHz));
      if (centreBins.length === 0) continue;

      let best = -Infinity;
      for (let offset = -search; offset <= search; offset++) {
        let sum = 0;
        let n = 0;
        for (const b of centreBins) {
          const k = b + offset;
          if (k >= 0 && k < bins) {
            sum += psd[k]!;
            n++;
          }
        }
        if (n > 0) best = Math.max(best, sum / n);
      }

      if (Number.isFinite(best)) levels[h - 1]!.push(best);
    }
  }

  return levels.map((values, i) => {
    if (values.length === 0) return empty[i]!;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sd = values.length > 1 ? Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / (values.length - 1)) : 0;

    return { harmonic: i + 1, meanDb: mean, sdDb: sd, segments: values.length };
  });
}

function meanSpinning(m: Float32Array, start: number, len: number): number | null {
  let sum = 0;
  let n = 0;

  for (let i = start; i < start + len && i < m.length; i++) {
    if (m[i]! > 0) {
      sum += m[i]!;
      n++;
    }
  }

  return n > 0 ? sum / n : null;
}

function psdDb(spectrum: Float64Array, bins: number, norm: number): Float64Array {
  const out = new Float64Array(bins);

  for (let k = 0; k < bins; k++) {
    const re = spectrum[2 * k]!;
    const im = spectrum[2 * k + 1]!;
    let p = (re * re + im * im) / norm;
    if (k > 0 && k < bins - 1) p *= 2;
    out[k] = p > 1e-30 ? 10 * Math.log10(p) : -120;
  }

  return out;
}

function smooth(x: Float64Array, width: number): Float64Array {
  if (width <= 1) return x;

  const half = Math.floor(width / 2);
  const cum = new Float64Array(x.length + 1);
  for (let i = 0; i < x.length; i++) cum[i + 1] = cum[i]! + x[i]!;

  return Float64Array.from(x, (_, i) => {
    const a = Math.max(0, i - half);
    const b = Math.min(x.length - 1, i + half);

    return (cum[b + 1]! - cum[a]!) / (b - a + 1);
  });
}
