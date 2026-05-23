/**
 * Closed-loop step response per axis via Wiener deconvolution of setpoint→gyro.
 *
 * Treats the closed-loop drone as an LTI system gyro = h ∗ setpoint + noise.
 * For each overlapping window of the log we solve for h in the frequency domain
 *
 *   H[k] = Y[k] · conj(X[k]) / (|X[k]|² + λ · mean(|X|²))
 *
 * with regularization λ to keep low-excitation bins from blowing up. IFFT gives
 * the impulse response; the cumulative sum is the step response. We normalize
 * each window's step so its settling region averages 1.
 *
 * This replaces the older Brian-White / pidtoolbox `PTstepcalc.m` approach,
 * which detected discrete stick-deceleration events and demanded ~400 ms of
 * clean steady state after each. That worked for acro flying but rejected
 * almost every event in cruise/long-range logs where maneuvers are spaced
 * <400 ms apart. The deconvolution approach uses every sample regardless of
 * inter-event spacing.
 */
import FFT from 'fft.js';

interface FFTImpl {
  size: number;
  createComplexArray(): number[];
  realTransform(out: Float64Array | number[], data: ArrayLike<number>): void;
  inverseTransform(out: Float64Array | number[], data: ArrayLike<number>): void;
  completeSpectrum(spectrum: Float64Array | number[]): void;
}

const FFTCtor = FFT as unknown as new (size: number) => FFTImpl;

export interface StepResponseResult {
  /** Per-sample time vector in ms (length = responseSamples + 1). */
  time: Float32Array;
  /** Per-window step responses, normalized to steady state = 1. */
  segments: Float32Array[];
  /** Windows whose deconvolution settled at a wildly wrong value (kept for diagnostics). */
  rejectedSegments: Float32Array[];
  /** Element-wise mean across `segments`. Empty if no segments. */
  mean: Float32Array;
  metrics: StepMetrics;
  diagnostics: StepDiagnostics;
}

export interface StepDiagnostics {
  /** Number of analysis windows the log was sliced into. */
  windowsTotal: number;
  /** Windows rejected because the setpoint excitation was below minExcitation. */
  windowsLowExcitation: number;
  /** Windows whose step response settled outside [settleMin, settleMax]. */
  windowsBadSettle: number;
  /** Windows that produced a usable step. */
  windowsAccepted: number;
  /** Peak |setpoint| observed in the analyzed range — used for the auto excitation default. */
  peakSetpoint: number;
}

export interface StepMetrics {
  /** Time from 10% → 90% steady state, in ms. */
  riseTimeMs: number | null;
  /** Peak overshoot above steady state, in %. 0 if no overshoot. */
  overshootPct: number | null;
  /** Time to enter and stay within ±5% of steady state, in ms. */
  settlingTimeMs: number | null;
  /** Time to first cross 50% of steady state, in ms. */
  latencyHalfMs: number | null;
  /** Absolute peak of the response (steady state = 1). */
  peakResponse: number | null;
}

export interface StepResponseOptions {
  /** Analysis-window length in ms. Default 1000. Longer = better LF resolution, fewer windows. */
  windowMs?: number;
  /** Step-response display length in ms. Default 500. */
  responseMs?: number;
  /** Overlap fraction in [0,1). 0.5 = 50% overlap. Default 0.5. */
  overlap?: number;
  /** Wiener regularization, as fraction of mean(|X|²). Default 0.01. */
  regularization?: number;
  /**
   * Skip windows whose peak |setpoint| is below this (deg/s). No excitation in
   * a window → deconvolution can't recover anything meaningful. Default 80;
   * scale this down for sleepy axes (e.g. yaw on a typical fixed-camera log).
   */
  minExcitation?: number;
  /** Reject windows whose step settled below this (relative to expected 1.0). Default 0.3. */
  settleMin?: number;
  /** Reject windows whose step settled above this. Default 2.0. */
  settleMax?: number;
}

const DEFAULTS = {
  windowMs: 1000,
  responseMs: 500,
  overlap: 0.5,
  regularization: 0.01,
  minExcitation: 80,
  settleMin: 0.3,
  settleMax: 2.0,
} as const;

export function computeStepResponse(
  setpoint: Float32Array,
  gyro: Float32Array,
  sampTimeUs: number,
  options: StepResponseOptions = {},
): StepResponseResult {
  const opts = { ...DEFAULTS, ...options };
  const sampleTimeMs = sampTimeUs / 1000;
  const n = Math.min(setpoint.length, gyro.length);
  if (sampleTimeMs <= 0 || n < 512) return emptyResult();

  const winSamples = Math.max(64, Math.round(opts.windowMs / sampleTimeMs));
  if (winSamples > n) return emptyResult();
  const hopSamples = Math.max(1, Math.round(winSamples * (1 - opts.overlap)));
  const respSamples = Math.max(8, Math.round(opts.responseMs / sampleTimeMs));
  const fftSize = nextPow2(winSamples * 2);

  // Time vector for the output step response.
  const stepLen = respSamples + 1;
  const time = new Float32Array(stepLen);
  for (let i = 0; i < stepLen; i++) time[i] = i * sampleTimeMs;

  // Track peak |setpoint| for diagnostics (drives the UI's auto-excitation suggestion).
  let peakSetpoint = 0;
  for (let i = 0; i < n; i++) {
    const v = Math.abs(setpoint[i]!);
    if (v > peakSetpoint) peakSetpoint = v;
  }

  const fft = new FFTCtor(fftSize);
  const hann = makeHannWindow(winSamples);
  const xPad = new Float64Array(fftSize);
  const yPad = new Float64Array(fftSize);
  const X = new Float64Array(fftSize * 2);
  const Y = new Float64Array(fftSize * 2);
  const H = new Float64Array(fftSize * 2);
  const h = new Float64Array(fftSize * 2);

  const segments: Float32Array[] = [];
  const rejectedSegments: Float32Array[] = [];
  let windowsTotal = 0;
  let windowsLowExcitation = 0;
  let windowsBadSettle = 0;

  for (let start = 0; start + winSamples <= n; start += hopSamples) {
    windowsTotal++;

    // Excitation gate — no stick activity in the window → nothing to deconvolve.
    let maxSp = 0;
    for (let i = 0; i < winSamples; i++) {
      const v = Math.abs(setpoint[start + i]!);
      if (v > maxSp) maxSp = v;
    }
    if (maxSp < opts.minExcitation) {
      windowsLowExcitation++;
      continue;
    }

    xPad.fill(0);
    yPad.fill(0);
    for (let i = 0; i < winSamples; i++) {
      const w = hann[i]!;
      xPad[i] = setpoint[start + i]! * w;
      yPad[i] = gyro[start + i]! * w;
    }

    fft.realTransform(X, xPad);
    fft.completeSpectrum(X);
    fft.realTransform(Y, yPad);
    fft.completeSpectrum(Y);

    // λ = regularization · mean(|X|²). Adaptive per window keeps the algorithm
    // stable across both quiet and saturating windows.
    let sumX2 = 0;
    for (let k = 0; k < fftSize; k++) {
      const xr = X[2 * k]!;
      const xi = X[2 * k + 1]!;
      sumX2 += xr * xr + xi * xi;
    }
    const lambda = opts.regularization * (sumX2 / fftSize);

    // H[k] = Y[k] · conj(X[k]) / (|X[k]|² + λ).
    for (let k = 0; k < fftSize; k++) {
      const xr = X[2 * k]!;
      const xi = X[2 * k + 1]!;
      const yr = Y[2 * k]!;
      const yi = Y[2 * k + 1]!;
      const numR = yr * xr + yi * xi;
      const numI = yi * xr - yr * xi;
      const den = xr * xr + xi * xi + lambda;
      H[2 * k] = numR / den;
      H[2 * k + 1] = numI / den;
    }

    fft.inverseTransform(h, H);

    // Step response = cumulative sum of impulse response (real part only).
    const step = new Float32Array(stepLen);
    let acc = 0;
    for (let i = 0; i < stepLen; i++) {
      acc += h[2 * i]!;
      step[i] = acc;
    }

    // Settle estimate: mean of last 25% of the step. Used both as the
    // normalization scale and as a sanity gate.
    const settleFrom = Math.floor(stepLen * 0.75);
    let sSum = 0;
    let sN = 0;
    for (let i = settleFrom; i < stepLen; i++) {
      sSum += step[i]!;
      sN++;
    }
    const settle = sN > 0 ? sSum / sN : 0;

    if (!Number.isFinite(settle) || settle < opts.settleMin || settle > opts.settleMax) {
      windowsBadSettle++;
      rejectedSegments.push(step);
      continue;
    }

    const norm = new Float32Array(stepLen);
    const inv = 1 / settle;
    for (let i = 0; i < stepLen; i++) norm[i] = step[i]! * inv;
    segments.push(norm);
  }

  const mean = meanAcrossSegments(segments, stepLen);
  const metrics = computeMetrics(time, mean);

  return {
    time,
    segments,
    rejectedSegments,
    mean,
    metrics,
    diagnostics: {
      windowsTotal,
      windowsLowExcitation,
      windowsBadSettle,
      windowsAccepted: segments.length,
      peakSetpoint,
    },
  };
}

/**
 * Combine multiple per-log step-response results into a single pooled result.
 * Every accepted segment from every input is concatenated into one set, the mean
 * is recomputed across the pool, and metrics are derived from that pooled mean.
 *
 * Useful when comparing many flights of the same craft / tune — averaging
 * across logs produces a much tighter, more representative step response than
 * any one log alone.
 *
 * Assumes inputs share the same sample rate / window length. Segments whose
 * length doesn't match the reference (longest) time vector are silently
 * skipped — that only happens if two logs were taken at different looptimes,
 * which can't be averaged meaningfully without resampling.
 */
export function combineStepResponses(results: StepResponseResult[]): StepResponseResult {
  if (results.length === 0) return emptyResult();
  if (results.length === 1) return results[0]!;

  const ref = results.reduce(
    (best, r) => (r.time.length > best.time.length ? r : best),
    results[0]!,
  );
  const stepLen = ref.time.length;
  if (stepLen === 0) return emptyResult();

  const segments: Float32Array[] = [];
  const rejectedSegments: Float32Array[] = [];
  let windowsTotal = 0;
  let windowsLowExcitation = 0;
  let windowsBadSettle = 0;
  let windowsAccepted = 0;
  let peakSetpoint = 0;

  for (const r of results) {
    for (const s of r.segments) if (s.length === stepLen) segments.push(s);
    for (const s of r.rejectedSegments) if (s.length === stepLen) rejectedSegments.push(s);
    windowsTotal += r.diagnostics.windowsTotal;
    windowsLowExcitation += r.diagnostics.windowsLowExcitation;
    windowsBadSettle += r.diagnostics.windowsBadSettle;
    windowsAccepted += r.diagnostics.windowsAccepted;
    if (r.diagnostics.peakSetpoint > peakSetpoint) peakSetpoint = r.diagnostics.peakSetpoint;
  }

  const mean = meanAcrossSegments(segments, stepLen);
  const metrics = computeMetrics(ref.time, mean);

  return {
    time: ref.time,
    segments,
    rejectedSegments,
    mean,
    metrics,
    diagnostics: {
      windowsTotal,
      windowsLowExcitation,
      windowsBadSettle,
      windowsAccepted,
      peakSetpoint,
    },
  };
}

function emptyResult(): StepResponseResult {
  return {
    time: new Float32Array(0),
    segments: [],
    rejectedSegments: [],
    mean: new Float32Array(0),
    metrics: {
      riseTimeMs: null,
      overshootPct: null,
      settlingTimeMs: null,
      latencyHalfMs: null,
      peakResponse: null,
    },
    diagnostics: {
      windowsTotal: 0,
      windowsLowExcitation: 0,
      windowsBadSettle: 0,
      windowsAccepted: 0,
      peakSetpoint: 0,
    },
  };
}

function computeMetrics(time: Float32Array, mean: Float32Array): StepMetrics {
  if (mean.length < 2) {
    return {
      riseTimeMs: null,
      overshootPct: null,
      settlingTimeMs: null,
      latencyHalfMs: null,
      peakResponse: null,
    };
  }
  const t10 = firstCrossing(time, mean, 0.1);
  const t90 = firstCrossing(time, mean, 0.9);
  const riseTimeMs = t10 != null && t90 != null && t90 >= t10 ? t90 - t10 : null;
  const latencyHalfMs = firstCrossing(time, mean, 0.5);

  let peak = -Infinity;
  for (let i = 0; i < mean.length; i++) if (mean[i]! > peak) peak = mean[i]!;
  const peakResponse = Number.isFinite(peak) ? peak : null;
  const overshootPct = peakResponse != null && peakResponse > 1 ? (peakResponse - 1) * 100 : 0;

  let settlingTimeMs: number | null = null;
  for (let i = mean.length - 1; i >= 0; i--) {
    if (Math.abs(mean[i]! - 1) > 0.05) {
      settlingTimeMs = i + 1 < mean.length ? time[i + 1]! : null;
      break;
    }
    if (i === 0) settlingTimeMs = time[0]!;
  }
  return { riseTimeMs, overshootPct, settlingTimeMs, latencyHalfMs, peakResponse };
}

function firstCrossing(time: Float32Array, signal: Float32Array, target: number): number | null {
  for (let i = 1; i < signal.length; i++) {
    const a = signal[i - 1]!;
    const b = signal[i]!;
    if (a < target && b >= target) {
      const frac = (target - a) / (b - a);
      return time[i - 1]! + frac * (time[i]! - time[i - 1]!);
    }
  }
  return null;
}

function meanAcrossSegments(segs: Float32Array[], len: number): Float32Array {
  if (segs.length === 0) return new Float32Array(0);
  const out = new Float32Array(len);
  for (const s of segs) for (let i = 0; i < len; i++) out[i] = out[i]! + s[i]!;
  const inv = 1 / segs.length;
  for (let i = 0; i < len; i++) out[i] = out[i]! * inv;
  return out;
}

function makeHannWindow(n: number): Float64Array {
  const out = new Float64Array(n);
  if (n < 2) {
    if (n === 1) out[0] = 1;
    return out;
  }
  for (let i = 0; i < n; i++) {
    out[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  }
  return out;
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}
