import type { ParsedLog } from './types';

export interface PidRow {
  p?: number;
  i?: number;
  d?: number;
  dMax?: number;
  f?: number;
}

export interface TuneView {
  hasPid: boolean;
  pidByAxis: ReadonlyArray<PidRow>;
  hasRates: boolean;
  rcRates: number[];
  rcExpo: number[];
  superRates: number[];
  gyroLpf1Hz?: number;
  gyroLpf1Type?: number;
  gyroLpf2Hz?: number;
  gyroLpf2Type?: number;
  gyroDynRange?: { min: number; max: number };
  gyroNotch1Hz?: number;
  gyroNotch1Cutoff?: number;
  gyroNotch2Hz?: number;
  gyroNotch2Cutoff?: number;
  dtermLpf1Hz?: number;
  dtermLpf1Type?: number;
  dtermLpf2Hz?: number;
  dtermLpf2Type?: number;
  dtermDynRange?: { min: number; max: number };
  dtermNotchHz?: number;
  dtermNotchCutoff?: number;
  rpmHarmonics?: number;
  /** Per-harmonic RPM notch weights, % (Betaflight 4.4+). */
  rpmWeights: number[];
  rpmMinHz?: number;
  rpmQ?: number;
  dynNotchCount?: number;
  dynNotchMin?: number;
  dynNotchMax?: number;
  dynNotchQ?: number;
  /** Gyro loop rate, Hz: gyro filters run at this rate. */
  gyroRateHz?: number;
  /** PID loop rate, Hz: D-term filters run at this rate. */
  pidRateHz?: number;
}

export function buildTuneView(log: ParsedLog): TuneView {
  const h = log.setup.rawHeaders;
  const num = (k: string): number | undefined => {
    const v = h[k];
    if (v == null) return undefined;
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const list = (k: string): number[] => {
    const v = h[k];
    if (!v) return [];
    return v.split(',').map((x) => Number.parseFloat(x.trim())).filter(Number.isFinite);
  };

  const axisKeys = ['roll', 'pitch', 'yaw'] as const;
  const dMinList = list('d_min');
  const pidByAxis: PidRow[] = axisKeys.map((key, axis) => {
    const arr = list(`${key}PID`);
    return {
      p: arr[0],
      i: arr[1],
      d: dMinList[axis] ?? num(`d_min_${key}`),
      dMax: num(`d_max_${key}`) ?? arr[2],
      f: arr[3] ?? num(`${key}FF`) ?? num(`feedforward_${key}`) ?? num(`ff_${key}`),
    };
  });
  const hasPid = pidByAxis.some((row) => row.p != null || row.i != null);

  const rcRates = list('rc_rates');
  const rcExpo = list('rc_expo');
  const superRates = list('rates');
  const hasRates = rcRates.length + rcExpo.length + superRates.length > 0;

  // Betaflight 4.3+ names first, then the older ones.
  const gyroDyn = dynRange(list('gyro_lpf1_dyn_hz'), num('dyn_lpf_gyro_min_hz'), num('dyn_lpf_gyro_max_hz'));
  const dtermDyn = dynRange(list('dterm_lpf1_dyn_hz'), num('dyn_lpf_dterm_min_hz'), num('dyn_lpf_dterm_max_hz'));
  const gyroNotchHz = list('gyro_notch_hz');
  const gyroNotchCutoff = list('gyro_notch_cutoff');
  const looptimeUs = num('looptime');
  const gyroRateHz = looptimeUs && looptimeUs > 0 ? 1e6 / looptimeUs : undefined;
  const pidDenom = num('pid_process_denom') ?? 1;

  return {
    hasPid,
    pidByAxis,
    hasRates,
    rcRates,
    rcExpo,
    superRates,
    gyroLpf1Hz: num('gyro_lpf1_static_hz') ?? num('gyro_lowpass_hz') ?? num('gyro_lpf_hz'),
    gyroLpf1Type: num('gyro_lpf1_type') ?? num('gyro_lowpass_type') ?? num('gyro_lpf_type'),
    gyroLpf2Hz: num('gyro_lpf2_static_hz') ?? num('gyro_lowpass2_hz') ?? num('gyro_lpf2_hz'),
    gyroLpf2Type: num('gyro_lpf2_type') ?? num('gyro_lowpass2_type'),
    gyroDynRange: gyroDyn,
    gyroNotch1Hz: num('gyro_notch1_hz') ?? gyroNotchHz[0],
    gyroNotch1Cutoff: num('gyro_notch1_cutoff') ?? gyroNotchCutoff[0],
    gyroNotch2Hz: num('gyro_notch2_hz') ?? gyroNotchHz[1],
    gyroNotch2Cutoff: num('gyro_notch2_cutoff') ?? gyroNotchCutoff[1],
    dtermLpf1Hz: num('dterm_lpf1_static_hz') ?? num('dterm_lpf_hz') ?? num('dterm_lowpass_hz'),
    dtermLpf1Type: num('dterm_lpf1_type') ?? num('dterm_lpf_type') ?? num('dterm_lowpass_type'),
    dtermLpf2Hz: num('dterm_lpf2_static_hz') ?? num('dterm_lpf2_hz') ?? num('dterm_lowpass2_hz'),
    dtermLpf2Type: num('dterm_lpf2_type') ?? num('dterm_lowpass2_type'),
    dtermDynRange: dtermDyn,
    dtermNotchHz: num('dterm_notch_hz'),
    dtermNotchCutoff: num('dterm_notch_cutoff'),
    rpmHarmonics: num('rpm_filter_harmonics'),
    rpmWeights: list('rpm_filter_weights'),
    rpmMinHz: num('rpm_filter_min_hz'),
    rpmQ: num('rpm_filter_q'),
    dynNotchCount: num('dyn_notch_count'),
    dynNotchMin: num('dyn_notch_min_hz'),
    dynNotchMax: num('dyn_notch_max_hz'),
    dynNotchQ: num('dyn_notch_q'),
    gyroRateHz,
    pidRateHz: gyroRateHz ? gyroRateHz / Math.max(1, pidDenom) : undefined,
  };
}

/** A dynamic lowpass is active only when its minimum cutoff is above 0. */
function dynRange(pair: number[], oldMin: number | undefined, oldMax: number | undefined) {
  const min = pair[0] ?? oldMin;
  const max = pair[1] ?? oldMax;

  return min != null && max != null && min > 0 ? { min, max } : undefined;
}
