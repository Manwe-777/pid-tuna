import type { FftImpl, HarmonicNoise, HarmonicNoiseOptions } from '../../types';
import { createFft } from '../../utils/createFft';
import { makeHannWindow } from '../../utils/makeHannWindow';
import { nextPow2 } from '../../utils/nextPow2';
import { windowPower } from './windowPower';

/** Settings and FFT state shared by every segment. */
interface HarmonicContext {
  harmonics: number;
  searchHz: number;
  smoothBins: number;
  segLen: number;
  sampleRateHz: number;
  fft: FftImpl;
  hann: Float64Array;
  winPower: number;
  binHz: number;
  bins: number;
  /** Search half-width in bins. */
  search: number;
  nyquist: number;
  buf: Float64Array;
  out: Float64Array;
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
  const segLen = Math.max(16, Math.round(sampleRateHz * (options.segmentSec ?? 0.3)));
  const hop = Math.max(1, Math.round(segLen / 2));
  const empty = Array.from({ length: harmonics }, (_, i) => ({
    harmonic: i + 1,
    meanDb: null,
    sdDb: null,
    segments: 0,
  }));
  if (signal.length < segLen || motorHz.length === 0 || sampleRateHz <= 0) return empty;

  const ctx = harmonicContext(options, harmonics, segLen, sampleRateHz);
  const levels: number[][] = Array.from({ length: harmonics }, () => []);

  for (let start = 0; start + segLen <= signal.length; start += hop) {
    const centres = motorHz.map((m) => meanSpinning(m, start, segLen));
    if (centres.every((c) => c == null)) continue;

    addSegmentLevels(levels, signal, start, centres, ctx);
  }

  return levels.map((values, i) => {
    if (values.length === 0) return empty[i]!;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sd = values.length > 1 ? Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / (values.length - 1)) : 0;

    return { harmonic: i + 1, meanDb: mean, sdDb: sd, segments: values.length };
  });
}

function harmonicContext(
  options: HarmonicNoiseOptions,
  harmonics: number,
  segLen: number,
  sampleRateHz: number,
): HarmonicContext {
  const searchHz = options.searchHz ?? 20;
  const smoothBins = options.smoothBins ?? 5;
  const size = nextPow2(segLen);
  const hann = makeHannWindow(segLen);
  const binHz = sampleRateHz / size;

  return {
    harmonics,
    searchHz,
    smoothBins,
    segLen,
    sampleRateHz,
    fft: createFft(size),
    hann,
    winPower: windowPower(hann),
    binHz,
    bins: size / 2 + 1,
    search: Math.floor(searchHz / binHz),
    nyquist: sampleRateHz / 2,
    buf: new Float64Array(size),
    out: new Float64Array(size * 2),
  };
}

/** PSD of the segment at `start`, then each harmonic's loudest level near the motors' bins. */
function addSegmentLevels(
  levels: number[][],
  signal: Float32Array,
  start: number,
  centres: (number | null)[],
  ctx: HarmonicContext,
): void {
  const { buf, out, hann, binHz, searchHz } = ctx;
  buf.fill(0);
  for (let i = 0; i < ctx.segLen; i++) buf[i] = signal[start + i]! * hann[i]!;
  ctx.fft.realTransform(out, buf);
  const psd = smooth(psdDb(out, ctx.bins, ctx.sampleRateHz * ctx.winPower), ctx.smoothBins);

  for (let h = 1; h <= ctx.harmonics; h++) {
    const centreBins = centres
      .filter((c): c is number => c != null && c * h + searchHz <= ctx.nyquist)
      .map((c) => Math.round((c * h) / binHz));
    if (centreBins.length === 0) continue;

    const best = loudestOffsetLevel(psd, centreBins, ctx.search, ctx.bins);
    if (Number.isFinite(best)) levels[h - 1]!.push(best);
  }
}

/** Highest mean PSD over the motors' bins, across offsets −search … +search; −∞ if none is in range. */
function loudestOffsetLevel(psd: Float64Array, centreBins: number[], search: number, bins: number): number {
  let best = -Infinity;

  for (let offset = -search; offset <= search; offset++) {
    const level = meanAtOffset(psd, centreBins, offset, bins);
    if (level != null) best = Math.max(best, level);
  }

  return best;
}

function meanAtOffset(psd: Float64Array, centreBins: number[], offset: number, bins: number): number | null {
  let sum = 0;
  let n = 0;

  for (const b of centreBins) {
    const k = b + offset;

    if (k >= 0 && k < bins) {
      sum += psd[k]!;
      n++;
    }
  }

  return n > 0 ? sum / n : null;
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
