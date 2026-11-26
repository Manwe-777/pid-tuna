import type { PidTermDef, PlotChrome, SignalDef, SpectralMode, StepMetricOption, TabId, Theme } from './types';

export const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: 'scorecard', label: 'Scorecard' },
  { id: 'tracking', label: 'Tracking' },
  { id: 'filtering', label: 'Raw vs filt' },
  { id: 'pid', label: 'PID terms' },
  { id: 'saturation', label: 'I-term sat' },
  { id: 'motors', label: 'Motors' },
  { id: 'balance', label: 'Balance' },
  { id: 'battery', label: 'Battery' },
  { id: 'gps', label: 'GPS' },
  { id: 'step', label: 'Step response' },
  { id: 'latency', label: 'Latency' },
  { id: 'spectrum', label: 'Full spectrum' },
  { id: 'filterSim', label: 'Filter sim' },
  { id: 'spectral', label: 'Spectral' },
  { id: 'settings', label: 'Tune settings' },
  { id: 'diff', label: 'Diff' },
];

export const SIM_ORIGINAL_COLOR = '#7a8597';

export const SIM_FILTERED_COLOR = '#5fffe0';

export const SIGNAL_DEFS: SignalDef[] = [
  { key: 'gyroFilt', label: 'Gyro (filtered)', perLog: false, color: '' /* uses axis color */ },
  { key: 'gyroRaw', label: 'Gyro prefilt', perLog: false, color: '#c8ced9' },
  { key: 'setpoint', label: 'Setpoint', perLog: false, color: '#5dffd6' },
  { key: 'pterm', label: 'P term', perLog: false, color: '#4ee08a' },
  { key: 'iterm', label: 'I term', perLog: false, color: '#e0d24e' },
  { key: 'dterm', label: 'D term', perLog: false, color: '#5fa8ff' },
  { key: 'dtermRaw', label: 'D term prefilt', perLog: false, color: '#9bd1ff' },
  { key: 'fterm', label: 'F term', perLog: false, color: '#bd5dff' },
  { key: 'pidsum', label: 'PID sum', perLog: false, color: '#e6e6e6' },
  { key: 'pidErr', label: 'PID error', perLog: false, color: '#ffaa5d' },
  { key: 'motor0', label: 'Motor 1', perLog: true, color: '#ff5d8f' },
  { key: 'motor1', label: 'Motor 2', perLog: true, color: '#5dff5d' },
  { key: 'motor2', label: 'Motor 3', perLog: true, color: '#5db4ff' },
  { key: 'motor3', label: 'Motor 4', perLog: true, color: '#fff75d' },
];

export const PSD_WINDOW_SIZES = [512, 1024, 2048, 4096] as const;

export const MOTOR_COLORS = ['#ff5d8f', '#5dff5d', '#5db4ff', '#fff75d'] as const;

export const DYN_NOTCH_COLOR = '#c58cff';

/** Headers worth showing in tune diff (compact subset of all raw headers). */
export const TUNE_DIFF_KEYS: readonly string[] = [
  'rollPID',
  'pitchPID',
  'yawPID',
  'd_min',
  'd_max_roll',
  'd_max_pitch',
  'd_max_yaw',
  'rollFF',
  'pitchFF',
  'yawFF',
  'feedforward_roll',
  'feedforward_pitch',
  'feedforward_yaw',
  'rc_rates',
  'rc_expo',
  'rates',
  'gyro_lpf1_static_hz',
  'gyro_lpf1_dyn_hz',
  'gyro_lpf1_type',
  'gyro_lpf2_static_hz',
  'gyro_lpf2_type',
  'gyro_notch_hz',
  'gyro_notch_cutoff',
  'dterm_lpf1_static_hz',
  'dterm_lpf1_dyn_hz',
  'dterm_lpf1_type',
  'dterm_lpf2_static_hz',
  'rpm_filter_fade_range_hz',
  'rpm_filter_weights',
  'gyro_lowpass_hz',
  'gyro_lowpass_type',
  'gyro_lowpass2_hz',
  'gyro_lowpass2_type',
  'gyro_notch1_hz',
  'gyro_notch1_cutoff',
  'gyro_notch2_hz',
  'gyro_notch2_cutoff',
  'dyn_lpf_gyro_min_hz',
  'dyn_lpf_gyro_max_hz',
  'dterm_lpf_hz',
  'dterm_lpf_type',
  'dterm_lpf2_hz',
  'dterm_lpf2_type',
  'dterm_notch_hz',
  'dterm_notch_cutoff',
  'dyn_lpf_dterm_min_hz',
  'dyn_lpf_dterm_max_hz',
  'rpm_filter_harmonics',
  'rpm_filter_q',
  'rpm_filter_min_hz',
  'dyn_notch_count',
  'dyn_notch_min_hz',
  'dyn_notch_max_hz',
  'dyn_notch_q',
  'looptime',
  'pid_process_denom',
  'motor_pwm_protocol',
];

export const NOISE_BANDS: ReadonlyArray<{ label: string; lo: number; hi: number }> = [
  { label: '0–100 Hz', lo: 0, hi: 100 },
  { label: '100–300 Hz', lo: 100, hi: 300 },
  { label: '300–500 Hz', lo: 300, hi: 500 },
  { label: '500+ Hz', lo: 500, hi: Infinity },
];

export const PID_TERM_DEFS: PidTermDef[] = [
  { key: 'pterm', signalKey: 'pterm', label: 'P', color: '#4ee08a' },
  { key: 'iterm', signalKey: 'iterm', label: 'I', color: '#e0d24e' },
  { key: 'dterm', signalKey: 'dterm', label: 'D', color: '#5fa8ff' },
  { key: 'dtermRaw', signalKey: 'dtermRaw', label: 'D prefilt', color: '#9bd1ff' },
  { key: 'fterm', signalKey: 'fterm', label: 'F', color: '#bd5dff' },
  { key: 'pidsum', signalKey: 'pidsum', label: 'PID sum', color: '#e6e6e6' },
  { key: 'pidErr', signalKey: 'pidErr', label: 'PID error', color: '#ffaa5d' },
];

export const SAT_BAND_COLOR = 'rgba(255, 112, 112, 0.18)';

export const VOLT_COLOR = '#5fa8ff';

export const CURRENT_COLOR = '#ffaa5d';

// Map each score row to the tab where the underlying detail lives, so the row
// is clickable as a shortcut.
export const SCORECARD_JUMP: Record<string, TabId> = {
  'Tracking latency': 'latency',
  'Filter group delay': 'latency',
  'Motor balance': 'balance',
  'Noise floor (100-300 Hz)': 'spectrum',
  'Step response (rise)': 'step',
  'Step response (overshoot)': 'step',
  'Battery sag': 'battery',
};

export const WINDOW_SIZES = [256, 512, 1024, 2048] as const;

export const SPECTRAL_MODES: ReadonlyArray<{ id: SpectralMode; label: string }> = [
  { id: 'freqTime', label: 'Frequency' },
  { id: 'freqThrottle', label: 'Freq vs Throttle' },
  { id: 'freqRpm', label: 'Freq vs RPM' },
  { id: 'psdTime', label: 'Power Spectral Density' },
  { id: 'psdThrottle', label: 'PSD vs Throttle' },
  { id: 'psdRpm', label: 'PSD vs RPM' },
  { id: 'errorSetpoint', label: 'Error vs Setpoint' },
];

export const HEATMAP_HEIGHT = 460;

export const ALL_AXIS = 3;

export const BAND_COLORS = ['#5db4ff', '#5dff8f', '#ffb45d', '#ff5d8f'] as const;

export const AXIS_NAMES = ['Roll', 'Pitch', 'Yaw'] as const;

export const AXIS_COLORS = ['#ff5d5d', '#4ee08a', '#5fa8ff'] as const;

/** Line-dash sequences used to differentiate logs on the same plot. */
export const DASH_PATTERNS: ReadonlyArray<readonly number[]> = [
  [], // 0: solid
  [6, 4], // 1: dashed
  [2, 3], // 2: dotted
  [10, 4, 3, 4], // 3: dash-dot
  [1, 2], // 4: tight dots
  [8, 3, 2, 3, 2, 3], // 5: dash-dot-dot
];

/** Distinct colors assigned per log in multi-log mode. */
export const LOG_COLORS: readonly string[] = [
  '#ff5d8f', // pink
  '#5fa8ff', // sky blue
  '#5dff5d', // bright green
  '#fff75d', // yellow
  '#bd5dff', // purple
  '#ff9b5d', // orange
];

export const STEP_METRICS: readonly StepMetricOption[] = [
  {
    key: 'riseTimeMs',
    label: 'Rise',
    unit: 'ms',
    digits: 1,
    help: 'Time from 10% to 90% of the settled level',
    axis: [0, 40],
  },
  {
    key: 'latencyHalfMs',
    label: '50%',
    unit: 'ms',
    digits: 1,
    help: 'Time to reach half of the settled level',
    axis: [0, 20],
  },
  { key: 'peakTimeMs', label: 'Peak at', unit: 'ms', digits: 1, help: 'Time of the highest point', axis: [0, 60] },
  {
    key: 'overshootPct',
    label: 'Overshoot',
    unit: '%',
    digits: 1,
    help: 'How far the peak goes past the settled level',
    axis: [0, 30],
  },
  {
    key: 'peakResponse',
    label: 'Peak',
    unit: '',
    digits: 2,
    help: 'Highest point, in setpoint units',
    reference: 1,
    axis: [0, 1.5],
  },
  {
    key: 'settlingTimeMs',
    label: 'Settle',
    unit: 'ms',
    digits: 0,
    help: 'Time to stay within ±5% of the settled level',
    axis: [0, 200],
  },
  {
    key: 'steadyState',
    label: 'Level',
    unit: '',
    digits: 2,
    help: 'Settled level relative to setpoint; below 1 means gyro falls short',
    reference: 1,
    axis: [0, 1.5],
  },
  {
    key: 'bandwidthHz',
    label: 'Bandwidth',
    unit: 'Hz',
    digits: 1,
    help: 'Frequency where tracking drops 3 dB; higher rejects propwash better',
    axis: [0, 40],
  },
  {
    key: 'sensitivityPeakDb',
    label: 'Sensitivity',
    unit: 'dB',
    digits: 1,
    help: 'Peak disturbance amplification |1 − T|; 4 dB caution, 6 dB close to oscillating',
    axis: [0, 8],
  },
  {
    key: 'phaseMarginDeg',
    label: 'Phase margin',
    unit: '°',
    digits: 0,
    help: 'How far the implied open loop is from oscillating; below about 30° it is close',
    axis: [0, 90],
  },
  {
    key: 'crossoverHz',
    label: 'Crossover',
    unit: 'Hz',
    digits: 1,
    help: 'Where the implied open loop crosses 0 dB: roughly how fast the loop reacts',
    axis: [0, 40],
  },
  {
    key: 'confidence',
    label: 'Confidence',
    unit: '',
    digits: 2,
    help: 'Coherence in the control band: how much of gyro the setpoint explains (1 = all)',
    axis: [0, 1],
  },
];

export const THEME_STORAGE_KEY = 'pidtuna:theme';

export const PLOT_COLORS: Record<Theme, PlotChrome> = {
  dark: {
    grid: '#1d242e',
    axis: '#9aa4b2',
    axisLine: '#3a4150',
    title: '#c8ced9',
    tick: '#8a93a3',
    caption: '#6c7383',
    label: '#5a6473',
  },
  light: {
    grid: '#dce1e8',
    axis: '#5a6472',
    axisLine: '#b0b8c4',
    title: '#2a3038',
    tick: '#5b636f',
    caption: '#7d8490',
    label: '#949ba6',
  },
};
