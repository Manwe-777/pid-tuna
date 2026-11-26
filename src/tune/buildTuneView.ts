import type { ParsedLog, PidRow, TuneView } from '../types';

type RawHeaders = ParsedLog['setup']['rawHeaders'];

export function buildTuneView(log: ParsedLog): TuneView {
  const h = log.setup.rawHeaders;

  const num = (k: string): number | undefined => headerNum(h, k);
  const list = (k: string): number[] => headerList(h, k);
  /** The first of these headers that holds a number. */
  const first = (...keys: string[]): number | undefined => firstHeaderNum(h, keys);

  const axisKeys = ['roll', 'pitch', 'yaw'] as const;
  const dMinList = list('d_min');
  const pidByAxis: PidRow[] = axisKeys.map((key, axis) => pidRow(h, key, dMinList[axis]));
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
    gyroLpf1Hz: first('gyro_lpf1_static_hz', 'gyro_lowpass_hz', 'gyro_lpf_hz'),
    gyroLpf1Type: first('gyro_lpf1_type', 'gyro_lowpass_type', 'gyro_lpf_type'),
    gyroLpf2Hz: first('gyro_lpf2_static_hz', 'gyro_lowpass2_hz', 'gyro_lpf2_hz'),
    gyroLpf2Type: first('gyro_lpf2_type', 'gyro_lowpass2_type'),
    gyroDynRange: gyroDyn,
    gyroNotch1Hz: num('gyro_notch1_hz') ?? gyroNotchHz[0],
    gyroNotch1Cutoff: num('gyro_notch1_cutoff') ?? gyroNotchCutoff[0],
    gyroNotch2Hz: num('gyro_notch2_hz') ?? gyroNotchHz[1],
    gyroNotch2Cutoff: num('gyro_notch2_cutoff') ?? gyroNotchCutoff[1],
    dtermLpf1Hz: first('dterm_lpf1_static_hz', 'dterm_lpf_hz', 'dterm_lowpass_hz'),
    dtermLpf1Type: first('dterm_lpf1_type', 'dterm_lpf_type', 'dterm_lowpass_type'),
    dtermLpf2Hz: first('dterm_lpf2_static_hz', 'dterm_lpf2_hz', 'dterm_lowpass2_hz'),
    dtermLpf2Type: first('dterm_lpf2_type', 'dterm_lowpass2_type'),
    dtermDynRange: dtermDyn,
    dtermNotchHz: num('dterm_notch_hz'),
    dtermNotchCutoff: num('dterm_notch_cutoff'),
    rpmHarmonics: num('rpm_filter_harmonics'),
    rpmWeights: list('rpm_filter_weights'),
    rpmFadeHz: num('rpm_filter_fade_range_hz'),
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

function headerNum(h: RawHeaders, k: string): number | undefined {
  const v = h[k];
  if (v == null) return undefined;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
}

function headerList(h: RawHeaders, k: string): number[] {
  const v = h[k];
  if (!v) return [];
  return v
    .split(',')
    .map((x) => Number.parseFloat(x.trim()))
    .filter(Number.isFinite);
}

function firstHeaderNum(h: RawHeaders, keys: string[]): number | undefined {
  for (const k of keys) {
    const n = headerNum(h, k);
    if (n !== undefined) return n;
  }

  return undefined;
}

/** One axis's PIDs: `<axis>PID` is P,I,D,F; newer firmware splits D into d_min / d_max. */
function pidRow(h: RawHeaders, key: string, dMin: number | undefined): PidRow {
  const arr = headerList(h, `${key}PID`);
  return {
    p: arr[0],
    i: arr[1],
    d: dMin ?? headerNum(h, `d_min_${key}`),
    dMax: headerNum(h, `d_max_${key}`) ?? arr[2],
    f: arr[3] ?? firstHeaderNum(h, [`${key}FF`, `feedforward_${key}`, `ff_${key}`]),
  };
}

/** A dynamic lowpass is active only when its minimum cutoff is above 0. */
function dynRange(pair: number[], oldMin: number | undefined, oldMax: number | undefined) {
  const min = pair[0] ?? oldMin;
  const max = pair[1] ?? oldMax;

  return min != null && max != null && min > 0 ? { min, max } : undefined;
}
