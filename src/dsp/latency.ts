import type { TuneView } from '../tuneView';

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

/* ------------------ Per-filter group delay (analytical) ------------------ */

export interface FilterDelayEntry {
  label: string;
  /** Configured cutoff or center frequency in Hz. */
  cutoffHz: number;
  /** Filter type label for display. */
  type: string;
  /** Group delay near DC, in ms. Notches contribute ~0 here. */
  groupDelayMs: number;
  /** True if the filter is dynamic (cutoff varies with flight conditions). */
  dynamic: boolean;
}

export interface FilterDelayBreakdown {
  entries: FilterDelayEntry[];
  /** Sum of all entry delays. */
  totalGroupDelayMs: number;
}

// Betaflight LPF type IDs.
const LPF_TYPE_NAME: Record<number, string> = {
  0: 'PT1',
  1: 'BIQUAD',
  2: 'PT2',
  3: 'PT3',
};

/**
 * Group delay near DC for the Betaflight LPF types, analytical form.
 *
 * - PT1 (1st-order Butterworth):        GD(0) = 1 / (2π · fc)
 * - PT2 = cascade of two PT1 sections:  GD(0) = 2 · PT1
 * - PT3 = cascade of three PT1 sections: GD(0) = 3 · PT1
 * - Biquad (Q ≈ 0.707, Butterworth):    GD(0) = √2 / (2π · fc)
 */
function lpfGroupDelayMs(cutoffHz: number, typeId: number | undefined): number {
  if (cutoffHz <= 0) return 0;
  const pt1 = 1000 / (2 * Math.PI * cutoffHz);
  switch (typeId ?? 0) {
    case 0: return pt1;
    case 1: return (Math.SQRT2 / (2 * Math.PI * cutoffHz)) * 1000;
    case 2: return 2 * pt1;
    case 3: return 3 * pt1;
    default: return pt1;
  }
}

/**
 * Build a per-filter breakdown of group delay near DC from a TuneView.
 *
 * Dynamic LPF filters (`dyn_lpf_*`) report the min-cutoff worst-case delay,
 * since that's the latency you'd hit while idle/throttle-down. RPM and dynamic
 * notch filters are listed but their delay isn't modeled because their cutoffs
 * track flight state.
 */
export function computeFilterDelays(view: TuneView): FilterDelayBreakdown {
  const entries: FilterDelayEntry[] = [];

  const pushLpf = (label: string, hz: number, typeId: number | undefined, dynamic: boolean) => {
    entries.push({
      label,
      cutoffHz: hz,
      type: LPF_TYPE_NAME[typeId ?? 0] ?? `type ${typeId}`,
      groupDelayMs: lpfGroupDelayMs(hz, typeId),
      dynamic,
    });
  };

  const pushNotch = (label: string, hz: number, cutoffHz: number) => {
    const bw = Math.max(1, hz - cutoffHz);
    entries.push({
      label,
      cutoffHz: hz,
      type: `notch · BW ${bw} Hz`,
      // Notch group delay at DC is ≈ 0; the delay budget hits at the notch center.
      groupDelayMs: 0,
      dynamic: false,
    });
  };

  // Gyro chain.
  const gyroLpf1Hz = view.gyroDynRange?.min ?? view.gyroLpf1Hz;
  if (gyroLpf1Hz && gyroLpf1Hz > 0) {
    pushLpf('Gyro LPF 1', gyroLpf1Hz, view.gyroLpf1Type, view.gyroDynRange != null);
  }
  if (view.gyroLpf2Hz && view.gyroLpf2Hz > 0) {
    pushLpf('Gyro LPF 2', view.gyroLpf2Hz, view.gyroLpf2Type, false);
  }
  if (view.gyroNotch1Hz && view.gyroNotch1Cutoff != null && view.gyroNotch1Hz > 0) {
    pushNotch('Gyro Notch 1', view.gyroNotch1Hz, view.gyroNotch1Cutoff);
  }
  if (view.gyroNotch2Hz && view.gyroNotch2Cutoff != null && view.gyroNotch2Hz > 0) {
    pushNotch('Gyro Notch 2', view.gyroNotch2Hz, view.gyroNotch2Cutoff);
  }

  // D-term chain.
  const dtermLpf1Hz = view.dtermDynRange?.min ?? view.dtermLpf1Hz;
  if (dtermLpf1Hz && dtermLpf1Hz > 0) {
    pushLpf('D-term LPF 1', dtermLpf1Hz, view.dtermLpf1Type, view.dtermDynRange != null);
  }
  if (view.dtermLpf2Hz && view.dtermLpf2Hz > 0) {
    pushLpf('D-term LPF 2', view.dtermLpf2Hz, view.dtermLpf2Type, false);
  }
  if (view.dtermNotchHz && view.dtermNotchCutoff != null && view.dtermNotchHz > 0) {
    pushNotch('D-term Notch', view.dtermNotchHz, view.dtermNotchCutoff);
  }

  // Adaptive filters — listed for context, delay not modeled.
  if (view.rpmHarmonics != null && view.rpmHarmonics > 0 && view.rpmMinHz != null) {
    entries.push({
      label: `RPM filter (${view.rpmHarmonics} harmonics)`,
      cutoffHz: view.rpmMinHz,
      type: `Q ${view.rpmQ ?? '?'} · tracks motor RPM`,
      groupDelayMs: 0,
      dynamic: true,
    });
  }
  if (view.dynNotchCount != null && view.dynNotchCount > 0) {
    entries.push({
      label: `Dynamic notch (×${view.dynNotchCount})`,
      cutoffHz: view.dynNotchMin ?? 0,
      type: `Q ${view.dynNotchQ ?? '?'} · tracks noise peaks`,
      groupDelayMs: 0,
      dynamic: true,
    });
  }

  const totalGroupDelayMs = entries.reduce((s, e) => s + e.groupDelayMs, 0);
  return { entries, totalGroupDelayMs };
}
