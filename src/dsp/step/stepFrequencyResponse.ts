import type { FrequencyMetrics, FrequencyResponse, StepSpectra } from '../../types';
import { relativeLambda } from './relativeLambda';

const MAX_HZ = 100;

const SMOOTH_HZ = 1;

const LOW_BAND: [number, number] = [0.5, 2];

const MIN_HZ = 1;

const CONFIDENCE_FALLBACK_HZ = 30;

/**
 * Closed-loop frequency response T(f) = Sxy / Sxx from pooled spectra, smoothed
 * over ±1 Hz, up to 100 Hz, with bandwidth, sensitivity peak and coherence.
 */
export function stepFrequencyResponse(spectra: StepSpectra): {
  response: FrequencyResponse;
  metrics: FrequencyMetrics;
} {
  const { fftSize, sampleTimeMs } = spectra;
  const df = 1000 / (sampleTimeMs * fftSize);
  const bins = Math.min(fftSize / 2, Math.floor(MAX_HZ / df) + 1);
  const half = Math.max(0, Math.round(SMOOTH_HZ / df));
  const lambda = relativeLambda(spectra.inputPower, spectra.regularization);

  const { frequencies, tRe, tIm, coherence } = smoothedTransfer(spectra, bins, half, lambda, df);
  const gain = lowBandGain(frequencies, tRe, tIm);
  const { magnitudeDb, phaseDeg, sensitivityDb } = normalisedPolar(tRe, tIm, gain);
  const response = { frequencies, magnitudeDb, phaseDeg, sensitivityDb, coherence };

  return { response, metrics: frequencyMetrics(response, gain > 0) };
}

/** T = Sxy / (Sxx + λ) and coherence per bin, each summed over ±half bins. */
function smoothedTransfer(
  spectra: StepSpectra,
  bins: number,
  half: number,
  lambda: number,
  df: number,
): { frequencies: Float32Array; tRe: Float64Array; tIm: Float64Array; coherence: Float32Array } {
  const { fftSize } = spectra;
  const frequencies = new Float32Array(bins);
  const tRe = new Float64Array(bins);
  const tIm = new Float64Array(bins);
  const coherence = new Float32Array(bins);

  for (let k = 0; k < bins; k++) {
    let cr = 0;
    let ci = 0;
    let px = 0;
    let py = 0;

    for (let j = Math.max(0, k - half); j <= Math.min(fftSize / 2, k + half); j++) {
      cr += spectra.crossSpectrum[2 * j]!;
      ci += spectra.crossSpectrum[2 * j + 1]!;
      px += spectra.inputPower[j]!;
      py += spectra.outputPower[j]!;
    }

    const width = Math.min(fftSize / 2, k + half) - Math.max(0, k - half) + 1;
    const den = px + lambda * width;
    frequencies[k] = k * df;
    tRe[k] = den > 0 ? cr / den : 0;
    tIm[k] = den > 0 ? ci / den : 0;
    coherence[k] = px > 0 && py > 0 ? Math.min(1, (cr * cr + ci * ci) / (px * py)) : 0;
  }

  return { frequencies, tRe, tIm, coherence };
}

/** Magnitude, unwrapped phase and sensitivity |1 − T| of T divided by its low-band gain. */
function normalisedPolar(
  tRe: Float64Array,
  tIm: Float64Array,
  gain: number,
): { magnitudeDb: Float32Array; phaseDeg: Float32Array; sensitivityDb: Float32Array } {
  const bins = tRe.length;
  const magnitudeDb = new Float32Array(bins);
  const phaseDeg = new Float32Array(bins);
  const sensitivityDb = new Float32Array(bins);
  let lastPhase = 0;
  let unwrap = 0;

  for (let k = 0; k < bins; k++) {
    const re = gain > 0 ? tRe[k]! / gain : 0;
    const im = gain > 0 ? tIm[k]! / gain : 0;
    magnitudeDb[k] = toDb(Math.hypot(re, im));
    sensitivityDb[k] = toDb(Math.hypot(1 - re, -im));

    const raw = (Math.atan2(im, re) * 180) / Math.PI;

    if (k > 0) {
      if (raw - lastPhase > 180) unwrap -= 360;
      else if (raw - lastPhase < -180) unwrap += 360;
    }

    lastPhase = raw;
    phaseDeg[k] = raw + unwrap;
  }

  return { magnitudeDb, phaseDeg, sensitivityDb };
}

function frequencyMetrics(r: FrequencyResponse, valid: boolean): FrequencyMetrics {
  if (!valid || r.frequencies.length < 3) {
    return {
      bandwidthHz: null,
      sensitivityPeakDb: null,
      sensitivityPeakHz: null,
      confidence: null,
      crossoverHz: null,
      phaseMarginDeg: null,
    };
  }

  const bandwidthHz = bandwidth(r);
  const { sensitivityPeakDb, sensitivityPeakHz, cohSum, cohN } = sensitivityAndCoherence(
    r,
    bandwidthHz ?? CONFIDENCE_FALLBACK_HZ,
  );

  return {
    ...phaseMargin(r),
    bandwidthHz,
    sensitivityPeakDb: Number.isFinite(sensitivityPeakDb) ? sensitivityPeakDb : null,
    sensitivityPeakHz: Number.isFinite(sensitivityPeakDb) ? sensitivityPeakHz : null,
    confidence: cohN > 0 ? cohSum / cohN : null,
  };
}

/** First frequency from MIN_HZ where the magnitude reaches −3 dB, interpolated between bins. */
function bandwidth(r: FrequencyResponse): number | null {
  for (let k = 1; k < r.frequencies.length; k++) {
    if (r.frequencies[k]! < MIN_HZ) continue;

    if (r.magnitudeDb[k]! <= -3) {
      const a = r.magnitudeDb[k - 1]!;
      const b = r.magnitudeDb[k]!;
      const frac = a === b ? 0 : (a + 3) / (a - b);

      return r.frequencies[k - 1]! + Math.min(1, Math.max(0, frac)) * (r.frequencies[k]! - r.frequencies[k - 1]!);
    }
  }

  return null;
}

/** Sensitivity peak from MIN_HZ up, and the coherence sum and count from MIN_HZ to `cohTop`. */
function sensitivityAndCoherence(
  r: FrequencyResponse,
  cohTop: number,
): { sensitivityPeakDb: number; sensitivityPeakHz: number; cohSum: number; cohN: number } {
  let sensitivityPeakDb = -Infinity;
  let sensitivityPeakHz = 0;
  let cohSum = 0;
  let cohN = 0;

  for (let k = 0; k < r.frequencies.length; k++) {
    const f = r.frequencies[k]!;
    if (f < MIN_HZ) continue;

    if (r.sensitivityDb[k]! > sensitivityPeakDb) {
      sensitivityPeakDb = r.sensitivityDb[k]!;
      sensitivityPeakHz = f;
    }

    if (f <= cohTop) {
      cohSum += r.coherence[k]!;
      cohN++;
    }
  }

  return { sensitivityPeakDb, sensitivityPeakHz, cohSum, cohN };
}

/** Open loop implied by the closed loop, L = T / (1 − T); crossover where |L| first falls through 1. */
function phaseMargin(r: FrequencyResponse): { crossoverHz: number | null; phaseMarginDeg: number | null } {
  const open = (k: number) => {
    const mag = 10 ** (r.magnitudeDb[k]! / 20);
    const ph = (r.phaseDeg[k]! * Math.PI) / 180;
    const tRe = mag * Math.cos(ph);
    const tIm = mag * Math.sin(ph);
    const dRe = 1 - tRe;
    const dIm = -tIm;
    const den = dRe * dRe + dIm * dIm;

    return { re: (tRe * dRe + tIm * dIm) / den, im: (tIm * dRe - tRe * dIm) / den };
  };

  for (let k = 1; k < r.frequencies.length; k++) {
    if (r.frequencies[k]! < MIN_HZ) continue;

    const a = open(k - 1);
    const b = open(k);
    const ma = Math.hypot(a.re, a.im);
    const mb = Math.hypot(b.re, b.im);
    if (!(ma >= 1 && mb < 1)) continue;

    const frac = (ma - 1) / (ma - mb);
    let margin = 180 + (Math.atan2(b.im, b.re) * 180) / Math.PI;
    if (margin > 360) margin -= 360;

    return {
      crossoverHz: r.frequencies[k - 1]! + frac * (r.frequencies[k]! - r.frequencies[k - 1]!),
      phaseMarginDeg: margin,
    };
  }

  return { crossoverHz: null, phaseMarginDeg: null };
}

function lowBandGain(f: Float32Array, re: Float64Array, im: Float64Array): number {
  let sum = 0;
  let n = 0;

  for (let k = 0; k < f.length; k++) {
    if (f[k]! < LOW_BAND[0] || f[k]! > LOW_BAND[1]) continue;
    sum += Math.hypot(re[k]!, im[k]!);
    n++;
  }

  return n > 0 ? sum / n : 0;
}

function toDb(x: number): number {
  return 20 * Math.log10(Math.max(1e-6, x));
}
