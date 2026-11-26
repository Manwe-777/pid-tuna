import type { AXIS_NAMES } from './constants';
import type { LatencyResult } from './dsp/latency';
import type { FrequencyResponse, StepSpectra } from './dsp/stepFrequencyResponse';
import type { metricSpread } from './dsp/stepMetricSpread';
import type { computeAxisSteps } from './utils/computeAxisSteps';

export type Axis3 = readonly [Float32Array, Float32Array, Float32Array];
export type Axis4 = readonly [Float32Array, Float32Array, Float32Array, Float32Array];

export interface SetupInfo {
  firmwareKind: string;
  firmwareVersion: string;
  craftName?: string;
  boardInfo?: string;
  debugMode?: string;
  pwmProtocol?: string;
  looptimeUs: number;
  sampleRateHz: number;
  /**
   * All `H key:value` headers from the blackbox file that blackbox-log didn't
   * classify into typed getters (so most tune-relevant settings: rollPID,
   * gyro_lowpass_hz, rpm_filter_*, dyn_notch_*, rc_rates, etc.).
   */
  rawHeaders: Readonly<Record<string, string>>;
  /** Active features (e.g. "RPM_FILTER", "DYNAMIC_FILTER"). */
  features: ReadonlyArray<string>;
}

export interface ParsedLog {
  fileName: string;
  logIndex: number;
  logCount: number;
  setup: SetupInfo;
  /** Zero-based time in seconds. Length = N samples. */
  time: Float32Array;
  /** Filtered gyro per axis (deg/s), [roll, pitch, yaw]. */
  gyroFilt: Axis3;
  /** Raw gyro per axis when available (from debug[0..2] = GYRO_SCALED). */
  gyroRaw: Axis3;
  /** PID error terms per axis. */
  pTerm: Axis3;
  iTerm: Axis3;
  /** D term: roll & pitch only (yaw typically has none). */
  dTerm: readonly [Float32Array, Float32Array];
  fTerm: Axis3;
  /** Setpoint per axis in deg/s (roll, pitch, yaw, throttle 0-100). */
  setpoint: Axis4;
  /** RC stick command per axis. */
  rcCommand: Axis4;
  /** Motor outputs (variable count). PWM command values. */
  motor: Float32Array[];
  /** Debug channels debug[0..7] as logged; their meaning depends on `setup.debugMode`. */
  debug: Float32Array[];
  /** Electrical RPM per motor (Betaflight logs eRPM/100). Empty if no RPM telemetry. */
  eRpm: Float32Array[];
  /** Slow-frame telemetry (battery / current / failsafe). May be empty if not logged. */
  slow: SlowFrameSeries;
  /** GPS-frame telemetry (per-fix coords, altitude, speed). May be empty. */
  gps: GpsFrameSeries;
  /**
   * Which optional data fields were actually present in the source log (vs.
   * zero-filled by the parser). Drives per-tab availability in the UI so we
   * don't show empty plots for missing data.
   */
  presence: DataPresence;
}

export interface DataPresence {
  /** Raw / unfiltered gyro columns logged (used by Raw-vs-filt and Filter sim tabs). */
  gyroRaw: boolean;
  /** PID terms (axisP/axisI/axisD/axisF) logged. */
  pidTerms: boolean;
  /** I term specifically — needed by the I-term saturation tab. */
  iTerm: boolean;
  /** Motor output columns present. */
  motors: boolean;
  /** eRPM telemetry from BiDirectional DSHOT. */
  eRpm: boolean;
  /** Battery voltage logged in slow frames. */
  vbat: boolean;
  /** Current draw logged in slow frames. */
  amperage: boolean;
  /** GPS frames present at all. */
  gps: boolean;
}

export interface SlowFrameSeries {
  /** Time of each slow frame in seconds (associated with most recent main-frame time). */
  time: Float32Array;
  /** Battery voltage in Volts, or empty if not logged. */
  vbat: Float32Array;
  /** Current draw in Amps, or empty if not logged. */
  amperage: Float32Array;
}

export interface GpsFrameSeries {
  /** Time of each GPS fix in seconds. */
  time: Float32Array;
  /** Latitude in degrees (positive = N). */
  lat: Float32Array;
  /** Longitude in degrees (positive = E). */
  lon: Float32Array;
  /** Altitude in meters (normalized at parse; FW may encode dm/cm in the raw file). Typically coarse GPS elevation. */
  altitude: Float32Array;
  /** Ground speed in m/s (normalized at parse; BF often logs cm/s in the raw GPS frame). */
  speed: Float32Array;
  /** Satellites in fix. */
  numSat: Float32Array;
}

export type TabId =
  | 'scorecard'
  | 'tracking'
  | 'filtering'
  | 'pid'
  | 'saturation'
  | 'motors'
  | 'balance'
  | 'battery'
  | 'gps'
  | 'step'
  | 'latency'
  | 'spectrum'
  | 'filterSim'
  | 'spectral'
  | 'settings'
  | 'diff';

export type SignalKey =
  | 'gyroFilt'
  | 'gyroRaw'
  | 'pterm'
  | 'iterm'
  | 'dterm'
  | 'dtermRaw'
  | 'fterm'
  | 'pidsum'
  | 'pidErr'
  | 'setpoint'
  | 'motor0'
  | 'motor1'
  | 'motor2'
  | 'motor3';

export interface SignalDef {
  key: SignalKey;
  label: string;
  /** If true, the signal is the same across all axes (e.g. motors). */
  perLog: boolean;
  /** Color used when the signal is not the per-axis gyro. */
  color: string;
}

export type PidTermKey = 'pterm' | 'iterm' | 'dterm' | 'dtermRaw' | 'fterm' | 'pidsum' | 'pidErr';

export interface PidTermDef {
  key: PidTermKey;
  signalKey: SignalKey; // for extractSignal()
  label: string;
  color: string;
}

export type SpectrogramSource = 'filt' | 'raw';

/**
 * Unified spectral-analysis tab: one heatmap view with a mode selector, à la
 * Blackbox Explorer. Frequency modes colour by amplitude (dB rel peak); PSD
 * modes colour by absolute power density (shared dB scale across axes). The
 * X domain is time, throttle %, or motor RPM depending on the mode; "Error vs
 * Setpoint" swaps the whole thing for a tracking-error density map.
 */
export type SpectralMode =
  'freqTime' | 'freqThrottle' | 'freqRpm' | 'psdTime' | 'psdThrottle' | 'psdRpm' | 'errorSetpoint';

export interface AxisLatency extends LatencyResult {
  axis: number;
}

export type AxisStepData = ReturnType<typeof computeAxisSteps>[number];

/** One curve per log, per merged pool, or per band. */
export interface StepCurveSet {
  id: string;
  label: string;
  color: string;
  dash: number[];
  axes: AxisStepData[];
}

export interface AxisStepWithSlot {
  id: string;
  label: string;
  color: string;
  dash: number[];
  data: AxisStepData;
}

export type AxisName = (typeof AXIS_NAMES)[number];

export type SlotState =
  | { kind: 'parsing'; fileName: string; progress: number; rows: number }
  | { kind: 'ready'; log: ParsedLog }
  | { kind: 'error'; fileName: string; message: string };

export interface LogSlot {
  id: string;
  state: SlotState;
  enabled: boolean;
  /** Index into DASH_PATTERNS — picks the line style. Solid for the first log. */
  dashIndex: number;
}

/** A windowed log paired with its slot for rendering attribution. */
export interface LogEntry {
  slot: LogSlot;
  /** Already sliced to the active time window. */
  log: ParsedLog;
  dash: number[];
}

export interface StepMetricOption {
  key: keyof StepMetrics;
  label: string;
  unit: string;
  digits: number;
  help: string;
  /** Reference line for dot plots (e.g. 1 for levels). */
  reference?: number;
  /** Range the dot-plot axis always shows, so a single dot isn't blown up. */
  axis?: [number, number];
}

export interface TimeRangeSec {
  start: number;
  end: number;
}

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
  /** RPM notches fade in over this range above their minimum frequency, Hz. */
  rpmFadeHz?: number;
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

export type Theme = 'light' | 'dark';

/**
 * Chrome colors for imperatively-drawn plots (uPlot axes, canvas heatmap frames,
 * inline SVG), mirroring the neutral tokens in the CSS so plots match the UI in
 * each theme. Data-encoding colors stay constant across themes.
 */
export interface PlotChrome {
  /** Grid lines / faint frames. */
  grid: string;
  /** uPlot axis stroke (tick labels + baseline). */
  axis: string;
  /** Tick marks / reference lines. */
  axisLine: string;
  /** Plot title text. */
  title: string;
  /** Primary tick-label text. */
  tick: string;
  /** Secondary axis captions (e.g. x tick numbers). */
  caption: string;
  /** Recessed axis labels (e.g. "log #"). */
  label: string;
}

/** The parts of fft.js the analyses use (its typings don't ship with the package). */
export interface FftImpl {
  size: number;
  createComplexArray(): number[];
  realTransform(out: Float64Array | number[], data: ArrayLike<number>): void;
  completeSpectrum(spectrum: Float64Array | number[]): void;
  inverseTransform(out: Float64Array | number[], data: ArrayLike<number>): void;
}

export interface StepResponseResult {
  /** Per-sample time vector in ms (length = responseSamples + 1). */
  time: Float32Array;
  /**
   * Per-window step responses that passed the screens, each scaled to the
   * pooled steady state (display only: single windows read low on their own,
   * so these show how much the shape varies, not the level).
   */
  segments: Float32Array[];
  /** Per-window step responses that were screened out (display only). */
  rejectedSegments: Float32Array[];
  /** Step response from the pooled spectra. Empty if no segment was accepted. */
  mean: Float32Array;
  /** Standard deviation of the scaled segments around their mean, per sample. */
  spread: Float32Array;
  /** Closed-loop frequency response from the pooled spectra, up to 100 Hz. */
  frequency: FrequencyResponse | null;
  metrics: StepMetrics;
  /**
   * Standard deviation of each time-domain metric across the single windows
   * (shape only: windows are scaled to the pooled level, so level has none).
   */
  metricSpread: Partial<Record<keyof StepMetrics, number>>;
  diagnostics: StepDiagnostics;
  /** Pooled spectra, kept so results from several logs can be combined. */
  pooled: StepSpectra | null;
}

export interface StepDiagnostics {
  /** Number of analysis windows the log was sliced into. */
  windowsTotal: number;
  /** Windows skipped because mean |setpoint| was below minExcitation. */
  windowsLowExcitation: number;
  /** Windows skipped because mean |setpoint| was above maxExcitation. */
  windowsHighExcitation: number;
  /** Windows skipped because too many samples were masked out (ground, idle, saturation). */
  windowsMasked: number;
  /** Windows whose own step settled outside the band or far from the median. */
  windowsBadSettle: number;
  /** Windows pooled into the result. */
  windowsAccepted: number;
  /** Peak |setpoint| observed in the analyzed range. */
  peakSetpoint: number;
}

export interface StepMetrics {
  /** Time from 10% → 90% of the steady-state level, in ms. */
  riseTimeMs: number | null;
  /** Peak above the steady-state level, in %. 0 if no overshoot. */
  overshootPct: number | null;
  /** Time of the highest point of the response, in ms. */
  peakTimeMs: number | null;
  /** Time to enter and stay within ±5% of the steady-state level, in ms. */
  settlingTimeMs: number | null;
  /** Time to first reach 50% of the steady-state level, in ms. */
  latencyHalfMs: number | null;
  /** Absolute peak of the response (setpoint = 1). */
  peakResponse: number | null;
  /** Mean level from 200 ms to the end (setpoint = 1). Below 1 means gyro falls short of setpoint. */
  steadyState: number | null;
  /** Closed-loop −3 dB bandwidth, Hz. */
  bandwidthHz: number | null;
  /** Peak of |1 − T|, dB. ≥ 6 dB means the loop is close to oscillating. */
  sensitivityPeakDb: number | null;
  sensitivityPeakHz: number | null;
  /** Mean coherence across the control band, 0–1: how much of gyro setpoint explains. */
  confidence: number | null;
  /** Gain crossover of the implied open loop, Hz. */
  crossoverHz: number | null;
  /** Phase margin of the implied open loop, degrees. Below ~30° the loop is close to oscillating. */
  phaseMarginDeg: number | null;
}

export interface StepResponseOptions {
  /** Analysis-window length in ms. Default 2000. */
  windowMs?: number;
  /** Step-response display length in ms. Default 500. */
  responseMs?: number;
  /** Overlap fraction in [0,1). Default 0.75. */
  overlap?: number;
  /** Regularisation λ, as a fraction of mean pooled input power. Default 0.001. */
  regularization?: number;
  /** Skip windows whose mean |setpoint| is below this, in deg/s. Default 20. */
  minExcitation?: number;
  /** Skip windows whose mean |setpoint| is above this, in deg/s. Default: no limit. */
  maxExcitation?: number;
  /** Per-sample usability (1 = usable); windows with under 90% usable samples are skipped. */
  mask?: Uint8Array;
  /** Drop windows whose own steady state is below this. Default 0.5. */
  settleMin?: number;
  /** Drop windows whose own steady state is above this. Default 1.5. */
  settleMax?: number;
  /** Drop windows whose steady state is more than k robust deviations from the median. Default 3. */
  outlierK?: number;
}

export interface StepFftContext {
  fft: FftImpl;
  fftSize: number;
  winSamples: number;
  hann: Float64Array;
  xPad: Float64Array;
  yPad: Float64Array;
  X: Float64Array;
  Y: Float64Array;
  H: Float64Array;
  h: Float64Array;
}

export type StepResultSpread = Partial<Record<keyof StepMetrics, number>>;

export type TimeMetrics = Pick<
  StepMetrics,
  'riseTimeMs' | 'overshootPct' | 'peakTimeMs' | 'settlingTimeMs' | 'latencyHalfMs' | 'peakResponse' | 'steadyState'
>;
