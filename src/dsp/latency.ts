/* ----------------------- Tracking latency (xcorr) ------------------------ */

export interface LatencyResult {
  /** Best-fit lag (gyro relative to setpoint) in milliseconds. */
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
}

/**
 * Cross-correlation tracking latency: lag where gyro best follows setpoint.
 *
 * Both signals are detrended (mean subtracted). Lag is searched in [0, maxLagMs]
 * since gyro can't physically lead setpoint. Returns the lag in ms plus a
 * normalized correlation (Pearson-style) at that lag.
 *
 * Unlike step-response rise-time, this works on any flight data — it doesn't
 * need detected steps.
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

  if (N < maxLag + 100 || sampleRateHz <= 0) {
    return { lagMs: 0, correlation: 0, reliable: false };
  }

  const sp = detrend(setpoint, N);
  const gy = detrend(gyro, N);

  const spRms = Math.sqrt(energy(sp) / N);
  if (spRms < minSetpointRms) {
    return { lagMs: 0, correlation: 0, reliable: false };
  }

  // Fixed normalization denominator — for maxLag ≪ N the per-lag energy change
  // is negligible (<<1%), and a fixed denom keeps lag-to-lag comparisons clean.
  const denom = Math.sqrt(energy(sp) * energy(gy));
  if (!Number.isFinite(denom) || denom <= 0) {
    return { lagMs: 0, correlation: 0, reliable: false };
  }

  let bestLag = 0;
  let bestCorr = -Infinity;
  for (let lag = 0; lag <= maxLag; lag++) {
    let acc = 0;
    const upper = N - lag;
    for (let t = 0; t < upper; t++) acc += sp[t]! * gy[t + lag]!;
    const corr = acc / denom;
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  return {
    lagMs: (bestLag / sampleRateHz) * 1000,
    correlation: bestCorr,
    reliable: bestCorr >= minCorrelation,
  };
}

function detrend(src: ArrayLike<number>, n: number): Float64Array {
  let sum = 0;
  for (let i = 0; i < n; i++) sum += src[i]!;
  const mean = sum / n;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = src[i]! - mean;
  return out;
}

function energy(x: Float64Array): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i]! * x[i]!;
  return s;
}
