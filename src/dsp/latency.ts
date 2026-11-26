import { createFft } from '../utils/createFft';

export interface LatencyResult {
  /** Best-fit lag (gyro relative to setpoint) in milliseconds, interpolated between samples. */
  lagMs: number;
  /** Normalized cross-correlation at the best lag, in [-1, 1]. */
  correlation: number;
  /** False if there wasn't enough signal energy or correlation to trust the result. */
  reliable: boolean;
}

interface LatencyOptions {
  /** Maximum lag to search, in ms. Default 80 ms. */
  maxLagMs?: number;
  /** Minimum setpoint RMS (deg/s) required for the result to be considered reliable. */
  minSetpointRms?: number;
  /** Minimum correlation magnitude required for reliability. */
  minCorrelation?: number;
  /** Per-sample usability (1 = usable): masked samples don't count, e.g. time on the ground. */
  mask?: Uint8Array;
}

const UNRELIABLE: LatencyResult = { lagMs: 0, correlation: 0, reliable: false };

/**
 * Cross-correlation tracking latency: lag where gyro best follows setpoint.
 *
 * Both signals are detrended over the usable samples and masked samples are
 * zeroed. The correlation is computed with an FFT, searched over [0, maxLagMs]
 * (gyro can't lead setpoint), and the peak is refined with a parabola through
 * its neighbours, so the lag isn't limited to whole logged samples.
 */
export function computeXcorrLatency(
  setpoint: ArrayLike<number>,
  gyro: ArrayLike<number>,
  sampleRateHz: number,
  options: LatencyOptions = {},
): LatencyResult {
  const maxLagMs = options.maxLagMs ?? 80;
  const minSetpointRms = options.minSetpointRms ?? 5;
  const minCorrelation = options.minCorrelation ?? 0.3;

  const N = Math.min(setpoint.length, gyro.length);
  const maxLag = Math.max(1, Math.round((maxLagMs * sampleRateHz) / 1000));
  if (N < maxLag + 100 || sampleRateHz <= 0) return UNRELIABLE;

  const sp = detrend(setpoint, N, options.mask);
  const gy = detrend(gyro, N, options.mask);
  const used = options.mask ? countUsable(options.mask, N) : N;
  if (used < maxLag + 100) return UNRELIABLE;

  const spEnergy = energy(sp);
  if (Math.sqrt(spEnergy / used) < minSetpointRms) return UNRELIABLE;

  const denom = Math.sqrt(spEnergy * energy(gy));
  if (!Number.isFinite(denom) || denom <= 0) return UNRELIABLE;

  const corr = crossCorrelation(sp, gy, maxLag);
  let best = 0;
  for (let lag = 1; lag <= maxLag; lag++) if (corr[lag]! > corr[best]!) best = lag;

  const offset = best > 0 && best < maxLag ? parabolicOffset(corr[best - 1]!, corr[best]!, corr[best + 1]!) : 0;
  const correlation = corr[best]! / denom;

  return {
    lagMs: ((best + offset) / sampleRateHz) * 1000,
    correlation,
    reliable: correlation >= minCorrelation,
  };
}

/** c[lag] = Σ x[t]·y[t + lag] for lag in [0, maxLag], via FFT. */
function crossCorrelation(x: Float64Array, y: Float64Array, maxLag: number): Float64Array {
  let size = 1;
  while (size < x.length + maxLag + 1) size <<= 1;

  const fft = createFft(size);
  const xp = new Float64Array(size);
  const yp = new Float64Array(size);
  xp.set(x);
  yp.set(y);

  const X = new Float64Array(size * 2);
  const Y = new Float64Array(size * 2);
  fft.realTransform(X, xp);
  fft.completeSpectrum(X);
  fft.realTransform(Y, yp);
  fft.completeSpectrum(Y);

  const P = new Float64Array(size * 2);
  for (let k = 0; k < size; k++) {
    const xr = X[2 * k]!;
    const xi = X[2 * k + 1]!;
    const yr = Y[2 * k]!;
    const yi = Y[2 * k + 1]!;
    P[2 * k] = xr * yr + xi * yi;
    P[2 * k + 1] = xr * yi - xi * yr;
  }

  const c = new Float64Array(size * 2);
  fft.inverseTransform(c, P);

  const out = new Float64Array(maxLag + 1);
  for (let lag = 0; lag <= maxLag; lag++) out[lag] = c[2 * lag]!;

  return out;
}

/** Vertex of the parabola through three equally spaced points, relative to the middle one. */
function parabolicOffset(a: number, b: number, c: number): number {
  const den = a - 2 * b + c;
  if (den >= 0) return 0;

  return Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / den));
}

function detrend(src: ArrayLike<number>, n: number, mask?: Uint8Array): Float64Array {
  let sum = 0;
  let count = 0;

  for (let i = 0; i < n; i++) {
    if (mask && !mask[i]) continue;
    sum += src[i]!;
    count++;
  }

  const mean = count > 0 ? sum / count : 0;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = mask && !mask[i] ? 0 : src[i]! - mean;

  return out;
}

function countUsable(mask: Uint8Array, n: number): number {
  let c = 0;
  for (let i = 0; i < n; i++) c += mask[i] ?? 0;

  return c;
}

function energy(x: Float64Array): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i]! * x[i]!;

  return s;
}
