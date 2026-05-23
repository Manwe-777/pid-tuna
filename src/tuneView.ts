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
  rpmMinHz?: number;
  rpmQ?: number;
  dynNotchCount?: number;
  dynNotchMin?: number;
  dynNotchMax?: number;
  dynNotchQ?: number;
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

  const gyroDynMin = num('dyn_lpf_gyro_min_hz');
  const gyroDynMax = num('dyn_lpf_gyro_max_hz');
  const dtermDynMin = num('dyn_lpf_dterm_min_hz');
  const dtermDynMax = num('dyn_lpf_dterm_max_hz');

  return {
    hasPid,
    pidByAxis,
    hasRates,
    rcRates,
    rcExpo,
    superRates,
    gyroLpf1Hz: num('gyro_lowpass_hz') ?? num('gyro_lpf_hz'),
    gyroLpf1Type: num('gyro_lowpass_type') ?? num('gyro_lpf_type'),
    gyroLpf2Hz: num('gyro_lowpass2_hz') ?? num('gyro_lpf2_hz'),
    gyroLpf2Type: num('gyro_lowpass2_type') ?? num('gyro_lpf2_type'),
    gyroDynRange: gyroDynMin != null && gyroDynMax != null ? { min: gyroDynMin, max: gyroDynMax } : undefined,
    gyroNotch1Hz: num('gyro_notch1_hz') ?? num('gyro_notch_hz'),
    gyroNotch1Cutoff: num('gyro_notch1_cutoff') ?? num('gyro_notch_cutoff'),
    gyroNotch2Hz: num('gyro_notch2_hz'),
    gyroNotch2Cutoff: num('gyro_notch2_cutoff'),
    dtermLpf1Hz: num('dterm_lpf_hz') ?? num('dterm_lowpass_hz'),
    dtermLpf1Type: num('dterm_lpf_type') ?? num('dterm_lowpass_type'),
    dtermLpf2Hz: num('dterm_lpf2_hz') ?? num('dterm_lowpass2_hz'),
    dtermLpf2Type: num('dterm_lpf2_type') ?? num('dterm_lowpass2_type'),
    dtermDynRange: dtermDynMin != null && dtermDynMax != null ? { min: dtermDynMin, max: dtermDynMax } : undefined,
    dtermNotchHz: num('dterm_notch_hz'),
    dtermNotchCutoff: num('dterm_notch_cutoff'),
    rpmHarmonics: num('rpm_filter_harmonics'),
    rpmMinHz: num('rpm_filter_min_hz'),
    rpmQ: num('rpm_filter_q'),
    dynNotchCount: num('dyn_notch_count'),
    dynNotchMin: num('dyn_notch_min_hz'),
    dynNotchMax: num('dyn_notch_max_hz'),
    dynNotchQ: num('dyn_notch_q'),
  };
}
