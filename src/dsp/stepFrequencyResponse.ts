export interface StepSpectra {
  fftSize: number;
  /** Sample period of the log, ms. */
  sampleTimeMs: number;
  /** Σ Y·conj(X), interleaved re/im, length 2·fftSize. */
  crossSpectrum: Float64Array;
  /** Σ |X|², length fftSize. */
  inputPower: Float64Array;
  /** Σ |Y|², length fftSize. */
  outputPower: Float64Array;
  regularization: number;
}

export interface FrequencyResponse {
  frequencies: Float32Array;
  /** |T| in dB, normalised so the 0.5–2 Hz gain is 0 dB. */
  magnitudeDb: Float32Array;
  /** Phase of T in degrees, unwrapped. */
  phaseDeg: Float32Array;
  /** |1 − T| in dB: how much a disturbance at this frequency is amplified. */
  sensitivityDb: Float32Array;
  /** Magnitude-squared coherence γ² in [0, 1]: how much of gyro is explained by setpoint. */
  coherence: Float32Array;
}

export interface FrequencyMetrics {
  /** First frequency where |T| falls 3 dB below its low-frequency gain, Hz. */
  bandwidthHz: number | null;
  /** Peak of |1 − T| up to MAX_HZ, dB. Above ~6 dB the loop is close to oscillating. */
  sensitivityPeakDb: number | null;
  sensitivityPeakHz: number | null;
  /** Mean coherence from 1 Hz to the bandwidth (or 30 Hz): 1 = gyro fully explained by setpoint. */
  confidence: number | null;
}

const MAX_HZ = 100;
const SMOOTH_HZ = 1;
const LOW_BAND: [number, number] = [0.5, 2];
const MIN_HZ = 1;
const CONFIDENCE_FALLBACK_HZ = 30;

/**
 * Closed-loop frequency response T(f) = Sxy / Sxx from pooled spectra, smoothed
 * over ±1 Hz, up to 100 Hz, with bandwidth, sensitivity peak and coherence.
 */
export function stepFrequencyResponse(spectra: StepSpectra): { response: FrequencyResponse; metrics: FrequencyMetrics } {
  const { fftSize, sampleTimeMs } = spectra;
  const df = 1000 / (sampleTimeMs * fftSize);
  const bins = Math.min(fftSize / 2, Math.floor(MAX_HZ / df) + 1);
  const half = Math.max(0, Math.round(SMOOTH_HZ / df));
  const lambda = relativeLambda(spectra.inputPower, spectra.regularization);

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

  const gain = lowBandGain(frequencies, tRe, tIm);
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

  const response = { frequencies, magnitudeDb, phaseDeg, sensitivityDb, coherence };

  return { response, metrics: frequencyMetrics(response, gain > 0) };
}

function frequencyMetrics(r: FrequencyResponse, valid: boolean): FrequencyMetrics {
  if (!valid || r.frequencies.length < 3) {
    return { bandwidthHz: null, sensitivityPeakDb: null, sensitivityPeakHz: null, confidence: null };
  }

  let bandwidthHz: number | null = null;
  for (let k = 1; k < r.frequencies.length; k++) {
    if (r.frequencies[k]! < MIN_HZ) continue;

    if (r.magnitudeDb[k]! <= -3) {
      const a = r.magnitudeDb[k - 1]!;
      const b = r.magnitudeDb[k]!;
      const frac = a === b ? 0 : (a + 3) / (a - b);
      bandwidthHz = r.frequencies[k - 1]! + Math.min(1, Math.max(0, frac)) * (r.frequencies[k]! - r.frequencies[k - 1]!);
      break;
    }
  }

  let sensitivityPeakDb = -Infinity;
  let sensitivityPeakHz = 0;
  let cohSum = 0;
  let cohN = 0;
  const cohTop = bandwidthHz ?? CONFIDENCE_FALLBACK_HZ;

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

  return {
    bandwidthHz,
    sensitivityPeakDb: Number.isFinite(sensitivityPeakDb) ? sensitivityPeakDb : null,
    sensitivityPeakHz: Number.isFinite(sensitivityPeakDb) ? sensitivityPeakHz : null,
    confidence: cohN > 0 ? cohSum / cohN : null,
  };
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

export function relativeLambda(power: Float64Array, regularization: number): number {
  let sum = 0;
  for (let k = 0; k < power.length; k++) sum += power[k]!;

  return (regularization * sum) / power.length;
}

function toDb(x: number): number {
  return 20 * Math.log10(Math.max(1e-6, x));
}
