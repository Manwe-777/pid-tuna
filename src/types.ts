import type { AXIS_NAMES } from './constants';
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

export interface LogDot {
  label: string;
  color: string;
  /** Null = "no data" — shown as a muted hollow ring on the baseline. */
  value: number | null;
  /** ±1σ whisker around the value, when known. */
  spread?: number | null;
}

export interface PlotGeom {
  /** Plot-area rect in CSS px. */
  left: number;
  top: number;
  plotW: number;
  plotH: number;
  /** Data-value range mapped across the rect. Top of the plot = yMax. */
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  fmtX: (v: number) => string;
  fmtY: (v: number) => string;
}

export interface PlotSeries {
  label: string;
  /** Sample values; length must equal `time.length`. */
  values: Float32Array;
  /** CSS color. */
  stroke: string;
  /** Optional dash pattern, e.g. [4, 4]. */
  dash?: number[];
  /** Line width in px (default 1). */
  width?: number;
}

export interface PlotMarker {
  /** X position in data units (same scale as `time`). */
  x: number;
  /** CSS color. */
  stroke: string;
  /** Line width in px (default 1). */
  width?: number;
  /** Dash pattern (default solid). */
  dash?: number[];
}

export interface PlotBand {
  /** Start of band in data units. */
  x0: number;
  /** End of band in data units. */
  x1: number;
  /** CSS fill color (typically with alpha). */
  fill: string;
}

export type Phase =
  | { kind: 'idle' }
  | { kind: 'connecting' }
  | { kind: 'sending'; portLabel: string }
  | { kind: 'success'; portLabel: string }
  | { kind: 'error'; message: string }
  | { kind: 'unsupported' };

export interface StepSettings {
  windowMs: number;
  minExcitation: number;
  /** 0 = no ceiling. */
  maxExcitation: number;
  minThrottle: number;
  excludeSaturation: boolean;
  outlierK: number;
  settleMin: number;
  settleMax: number;
  yMax: number;
  showSegments: boolean;
  showSpread: boolean;
  showFrequency: boolean;
  dotMetrics: [keyof StepMetrics, keyof StepMetrics];
  splitBy: 'none' | 'stick' | 'throttle';
}

export interface StepFrequencyEntry {
  label: string;
  color: string;
  response: FrequencyResponse;
}

export interface StepStatsRow {
  id: string;
  label: string;
  color: string;
  windows: number;
  metrics: StepMetrics;
}

export interface BatteryAnalysis {
  hasVoltage: boolean;
  hasCurrent: boolean;
  /** Cell count, Betaflight's rule on the resting voltage (median of the first second). */
  cellCount: number | null;
  /** First non-noise reading — proxy for "at rest" voltage when armed. */
  voltageStart: number | null;
  /** Final reading — voltage at end of log. */
  voltageEnd: number | null;
  /** Lowest voltage after a half-second median filter (deepest sustained sag). */
  voltageMin: number | null;
  /** Highest voltage after a half-second median filter. */
  voltageMax: number | null;
  /** Voltage lost to the pack's internal resistance at the mean high-load current (top 25% of readings). */
  sagUnderLoadV: number | null;
  /** Voltage lost to internal resistance at peak current. */
  sagAtPeakV: number | null;
  /** Pack internal resistance from voltage vs current, discharge trend removed, mΩ. */
  internalResistanceMohm: number | null;
  /** Per-cell min voltage if cell count known. */
  perCellMin: number | null;
  /** Per-cell end voltage if cell count known. */
  perCellEnd: number | null;
  /** Mean current draw in Amps. */
  meanCurrentA: number | null;
  /** Peak current draw in Amps. */
  peakCurrentA: number | null;
  /** Total charge consumed in mAh (integration of current over time). */
  mAhUsed: number | null;
  /** RMS current draw — proxy for energy demand. */
  rmsCurrentA: number | null;
}

export interface Biquad {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

export type BfFilterKind = 'pt1' | 'pt2' | 'pt3' | 'biquad' | 'notch';

export interface BfFilterSpec {
  kind: BfFilterKind;
  /** Cutoff for lowpass filters, centre for notches, Hz. */
  hz: number;
  /** Notch Q (centre / bandwidth). Lowpass biquads use Butterworth Q. */
  q?: number;
}

export interface ChainResponse {
  /** |H|, linear. */
  magnitude: number;
  /** Phase in radians (negative = lag), unwrapped across sections. */
  phase: number;
}

export interface ErrorSetpointInput {
  setpoint: Float32Array;
  gyro: Float32Array;
  /** Per-sample usability (1 = use), e.g. takeoff to landing. */
  mask?: Uint8Array;
  /** Shift gyro back by this many samples before taking the error. Default 0. */
  lagSamples?: number;
}

export interface ErrorSetpointOptions {
  /** Setpoint (X) bin count. Default 120. */
  xBins?: number;
  /** Error (Y) bin count. Default 120. */
  yBins?: number;
  /** Force symmetric setpoint half-range (deg/s). Default: from data. */
  setpointRange?: number;
  /** Force symmetric error half-range (deg/s). Default: from data. */
  errorRange?: number;
}

export interface ErrorSetpointResult {
  /** Setpoint bin centers (deg/s). Length = xBins. */
  xCenters: Float32Array;
  /** Error bin centers (deg/s). Length = yBins. */
  yCenters: Float32Array;
  /** Density in [0,1] (log1p of counts, normalized), indexed [yBin*xBins + xBin].
   *  yBin 0 is the most-negative error (bottom of the plot). */
  density: Float32Array;
  /** Mean error per setpoint bin, NaN where a bin holds under 0.2% of the samples. */
  meanError: Float32Array;
  xBins: number;
  yBins: number;
  /** Symmetric half-ranges actually used. */
  setpointRange: number;
  errorRange: number;
  /** Samples that landed in the grid. */
  sampleCount: number;
  /** RMS of the error over all used samples, deg/s. */
  rmsError: number | null;
  /**
   * Least-squares slope of error against setpoint: the fraction of setpoint
   * gyro falls short by (0.05 = gyro reaches 95% of setpoint).
   */
  trackingSlope: number | null;
}

export type FilterChain = 'gyro' | 'dterm';

export interface FilterDelayEntry {
  label: string;
  chain: FilterChain;
  /** Cutoff (lowpass) or centre (notch) used for the calculation, Hz. */
  cutoffHz: number;
  type: string;
  /** Phase delay at the reference frequency, ms. */
  delayMs: number;
  /** Phase lag at the reference frequency, degrees. */
  phaseDeg: number;
  /** The cutoff moves in flight; the value shown is the stated worst or typical case. */
  dynamic: boolean;
  note?: string;
}

export interface FilterDelayBreakdown {
  referenceHz: number;
  entries: FilterDelayEntry[];
  /** Delay every PID term sees: the gyro filters. */
  gyroDelayMs: number;
  /** Delay the D term sees: gyro filters plus D-term filters. */
  dPathDelayMs: number;
}

export interface FilterDelayContext {
  motorCount?: number;
  /** Median motor fundamental in flight, Hz, when RPM telemetry is logged. */
  motorHz?: number;
  /** Frequency the delay is reported at. Default DELAY_REFERENCE_HZ. */
  referenceHz?: number;
}

export interface FilterPart {
  kind: BfFilterKind;
  hz: number;
  q?: number;
  /** Blend with the unfiltered signal, 0–1: y = (1 − w)·x + w·H(x). Default 1. */
  weight?: number;
  /** How many identical copies run in series (RPM notches: one per motor). Default 1. */
  copies?: number;
}

export type FilterType = BfFilterKind | 'rpm' | 'dynNotch';

export interface FilterSpec {
  /** Stable React key. */
  id: string;
  enabled: boolean;
  type: FilterType;
  /** Cutoff (lowpass), centre (notch, dynamic notch) or motor fundamental (RPM), in Hz. */
  cutoffHz: number;
  /** Notch bandwidth in Hz (Q = centre / bandwidth). */
  bandwidth: number;
  /** RPM and dynamic notch Q, Betaflight scale (500 = Q 5). */
  bfQ?: number;
  /** RPM: harmonics. Dynamic notch: number of notches. */
  count?: number;
  /** RPM: minimum notch frequency, Hz. */
  minHz?: number;
  /** RPM: fade range above the minimum, Hz. */
  fadeHz?: number;
  /** RPM: per-harmonic weights, %. */
  weights?: number[];
  /** RPM: number of motors (one notch set per motor). */
  motors?: number;
}

export interface FilterResponseResult {
  frequencies: Float32Array;
  /** |H(f)| in dB. */
  magnitudeDb: Float32Array;
  /** Phase delay −φ(f)/(2πf) in ms. */
  phaseDelayMs: Float32Array;
  /** Whether at least one filter was active when computing this response. */
  hasFilters: boolean;
}

export type TestSignalKind = 'step' | 'impulse' | 'chirp';

export interface ChirpOptions {
  startHz: number;
  endHz: number;
  /** Seconds. */
  duration: number;
  /** Standard deviation of added Gaussian noise, relative to the unit sine. */
  noise?: number;
}

export interface TestSignalResult {
  /** Time of each sample, ms. */
  timeMs: Float32Array;
  input: Float32Array;
  output: Float32Array;
}

export interface GpsSample {
  t: number;
  lat: number;
  lon: number;
}

/** Map ground-track appearance only — time-series altitude/speed stay raw. */
export interface GpsMapSmoothSettings {
  /** When false, lat/lon are copied unchanged (CRS step count still applies visually). */
  spatialSmooth: boolean;
  /**
   * Forward EWMA blend factor per sample (`Sᵢ = λ·rᵢ + (1−λ)·Sᵢ₋₁` in meters).
   * Low λ ⇒ strong low-pass ⇒ softens quantized “stair” lat/lon; high λ ⇒ follows raw fixes.
   * Ignored when `spatialSmooth` is false.
   */
  ewmaLambda: number;
  /** Optional Hann pass after EWMA for final polish — 0 to skip. */
  hannPasses: number;
  hannHalfWinCap: number;
  minRunFloor: number;
  /**
   * Catmull–Rom subdivisions per latch chord (− 1 interpolation steps).
   * `≤ 1` → straight chords through smoothed knots.
   */
  crsChordSteps: number;
}

export interface V2 {
  x: number;
  y: number;
}

export interface GpsAnalysis {
  hasFix: boolean;
  /** Center of the flight's bounding box (degrees). */
  centerLat: number;
  centerLon: number;
  /** Track points projected to meters relative to centerLat/Lon (equirectangular). */
  xMeters: Float32Array;
  yMeters: Float32Array;
  /** Aligned with the original time array. */
  time: Float32Array;
  /** Total distance flown in meters. */
  totalDistanceM: number;
  /** Max altitude in meters across the window. */
  maxAltitudeM: number | null;
  /** Min altitude in meters. */
  minAltitudeM: number | null;
  /** Max speed in m/s. */
  maxSpeedMs: number | null;
  /** Mean speed in m/s. */
  meanSpeedMs: number | null;
  /** Min satellite count. */
  minSats: number | null;
}

export interface AxisHarmonicNoise {
  filtered: HarmonicNoise[];
  /** Null when the log has no unfiltered gyro. */
  unfiltered: HarmonicNoise[] | null;
}

export interface LatencyResult {
  /** Best-fit lag (gyro relative to setpoint) in milliseconds, interpolated between samples. */
  lagMs: number;
  /** Normalized cross-correlation at the best lag, in [-1, 1]. */
  correlation: number;
  /** False if there wasn't enough signal energy or correlation to trust the result. */
  reliable: boolean;
}

export interface MotorStats {
  motorIndex: number;
  /** Mean motor command above the output's zero point (motorOutput low end), in flight. */
  pwmMean: number;
  /** Standard deviation of the motor command. Indicates how hard the motor is fighting. */
  pwmStd: number;
  /** Mean throttle as 0-100% of the across-motors max mean (relative balance). */
  relativeLoad: number;
  /** Mean eRPM (×100 to undo Betaflight's eRPM/100 logging). null if not telemetered. */
  meanERpm: number | null;
  /** Coefficient of variation of eRPM (std/mean). Higher = noisier RPM. null if not available. */
  erpmCv: number | null;
}

export interface MotorPsd {
  frequencies: Float32Array;
  psdDb: Float32Array;
}

export type AxisKind = 'pitch' | 'roll' | 'yaw';

/**
 * Signed imbalance on one of the three rigid-body axes. Sign is determined by
 * the default Quad-X mixer coefficients — the user is the one who knows their
 * motor mapping and can interpret the direction.
 *
 * Sign conventions (per Betaflight default mixer):
 *   pitch: (M1 + M3) − (M2 + M4) — positive when M1/M3 pair runs higher
 *   roll:  (M1 + M2) − (M3 + M4) — positive when M1/M2 pair runs higher
 *   yaw:   (M2 + M3) − (M1 + M4) — positive when M2/M3 (CCW in default) pair runs higher
 */
export interface AxisImbalance {
  axis: AxisKind;
  /** Signed delta as a % of the overall mean motor command. */
  deltaPct: number;
}

export interface BalanceAnalysis {
  motors: MotorStats[];
  /** Per-axis imbalance. Empty for non-4-motor frames. */
  axes: AxisImbalance[];
  /** Whichever axis dominates if any exceeds the threshold; null otherwise. */
  dominantAxis: AxisKind | null;
  /** A single motor far from the rest (large gap to next motor). null if no clear outlier. */
  singleMotorOutlier: { motorIndex: number; deltaPct: number } | null;
  /** Per-motor PSD of the motor command signal. */
  motorPsds: MotorPsd[];
}

export interface HarmonicNoise {
  /** 1 = motor fundamental, 2 = second harmonic, … */
  harmonic: number;
  /** Mean PSD at the harmonic across segments, dB (power per Hz). */
  meanDb: number | null;
  sdDb: number | null;
  /** Segments that had a usable motor frequency. */
  segments: number;
}

export interface HarmonicNoiseOptions {
  harmonics?: number;
  /** Search ± this many Hz around each harmonic for its peak. Default 20. */
  searchHz?: number;
  /** Segment length, s. Default 0.3. */
  segmentSec?: number;
  /** Box smoothing of each segment's PSD, in bins. Default 5. */
  smoothBins?: number;
}

export interface SaturationRun {
  /** Time of first saturated sample (s). */
  t0: number;
  /** Time of last saturated sample (s). */
  t1: number;
}

export interface AxisSaturation {
  axisIndex: number;
  axisName: string;
  /** I-term limit for this axis (same units as the logged I term). */
  limit: number;
  /** Saturation threshold used: 95% of the limit. */
  threshold: number;
  /** Mean |iTerm| in flight, useful for context. */
  meanAbs: number;
  /** Peak |iTerm| in flight. */
  peakAbs: number;
  /** Fraction of in-flight samples at or above the threshold, in [0, 1]. */
  fraction: number;
  /** Distinct saturation runs (each is a continuous span). */
  runs: SaturationRun[];
  /** Longest run duration in seconds. */
  longestRunSec: number;
}

export type ItermLimitSource = 'windup' | 'header' | 'default';

export interface SaturationAnalysis {
  /** Roll/pitch I-term limit. */
  itermLimit: number;
  /** How the limit was found: from iterm_windup × pidsum_limit, an iterm_limit header, or Betaflight's default 400. */
  limitSource: ItermLimitSource;
  /** Threshold used on roll/pitch (95% of the limit). */
  thresholdUsed: number;
  axes: AxisSaturation[];
}

export type ScoreStatus = 'good' | 'warn' | 'bad' | 'na';

export interface ScoreEntry {
  /** Display name. */
  key: string;
  status: ScoreStatus;
  /** Primary value(s) to surface (e.g., "18.5 / 22.3 / 15 ms"). */
  value: string;
  /** One-line context shown beneath the value. */
  detail?: string;
}

export interface Scorecard {
  entries: ScoreEntry[];
}

/**
 * `magnitude` — amplitude spectrum in dB relative to the spectrogram's peak
 * (0 dB = loudest bin, values flow downward). This is the classic view.
 * `psd` — one-sided power-spectral-density in *absolute* dB (10·log10 of
 * power/Hz), not peak-normalized, so the noise floor can be read directly and
 * compared across logs / throttle / RPM. Callers should colour PSD heatmaps
 * against the data's own min/max rather than assuming a 0 dB ceiling.
 */
export type SpectralValueMode = 'magnitude' | 'psd';

export interface SpectrogramOptions {
  /** FFT window length (samples). Must be a power of two. Default 512. */
  windowSize?: number;
  /** Hop length (samples). Default = windowSize / 2 (50% overlap). */
  hopSize?: number;
  /** Floor magnitudes below this in dB. Default -80 (magnitude) / -200 (psd). */
  floorDb?: number;
  /** Amplitude (default) vs power-spectral-density scaling. */
  mode?: SpectralValueMode;
}

export interface SpectrogramResult {
  /** Time of each window center, in seconds. */
  times: Float32Array;
  /** Frequency of each bin, in Hz. Length = freqBins. */
  frequencies: Float32Array;
  /** Values in dB, indexed [t * freqBins + f]. Magnitude mode: relative to peak,
   *  floored to floorDb. PSD mode: absolute dB. */
  magnitudes: Float32Array;
  freqBins: number;
  timeBins: number;
  /** Peak magnitude (in linear units) used as the 0 dB reference (magnitude mode). */
  peakMagnitude: number;
  /** Which scaling was used. */
  valueMode: SpectralValueMode;
}

export interface BinnedSpectrogramOptions {
  /** Number of domain (X) bins (default 100). */
  bins?: number;
  /** Lower domain edge (default 0). */
  domainMin?: number;
  /** Upper domain edge (default 100 — suits throttle %). */
  domainMax?: number;
  /** Domain smoothing window in domain units: segments within ±window of a bin
   *  center contribute to that bin. Default = 6% of the domain span. */
  domainWindow?: number;
  /** Segment length in seconds (default 0.2 s, matches PTthrSpec). */
  segmentSec?: number;
  /** dB floor (default -80 magnitude / -200 psd). */
  floorDb?: number;
  /** Domain-axis box-filter row count (default 8). */
  smoothRows?: number;
  /** Frequency box-filter col count; default derived from segment length. */
  smoothCols?: number;
  /** Amplitude (default) vs power-spectral-density scaling. */
  mode?: SpectralValueMode;
}

export interface BinnedSpectrogramResult {
  /** Domain (X) bin centers. Length = xBins. */
  xCenters: Float32Array;
  /** Frequency bin centers (Hz). Length = freqBins. */
  frequencies: Float32Array;
  /** dB values, indexed [xBin * freqBins + freqBin]. Magnitude: relative to
   *  peak, floored. PSD: absolute dB. */
  magnitudes: Float32Array;
  freqBins: number;
  xBins: number;
  valueMode: SpectralValueMode;
}

export interface PsdOptions {
  /** FFT window length (samples). Must be power of two. Default 1024. */
  windowSize?: number;
  /** Window overlap fraction (0-1). Default 0.5. */
  overlap?: number;
  /** dB floor; values below this clipped (default -200 to preserve headroom). */
  floorDb?: number;
}

export interface PsdResult {
  /** Frequency bin centers (Hz). Length = freqBins. */
  frequencies: Float32Array;
  /** Power-spectral-density in dB (10*log10 of power/Hz). Length = freqBins. */
  psdDb: Float32Array;
  /** Number of windows averaged. 0 means signal too short. */
  numWindows: number;
}

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
  /** Where the implied open loop L = T / (1 − T) falls through 0 dB, Hz. */
  crossoverHz: number | null;
  /** 180° + phase of L at the crossover: how far the loop is from oscillating. */
  phaseMarginDeg: number | null;
}

export type StepBandKind = 'stick' | 'throttle';

export interface StepBand {
  label: string;
  from: number;
  to: number;
  result: StepResponseResult;
}

export type StepLogOptions = StepResponseOptions & StepMaskOptions;

export interface StepMaskOptions {
  /** Keep only takeoff to landing. */
  flightOnly?: boolean;
  /** Samples below this stick throttle (%) are unusable; used to look at one throttle band. */
  minThrottle?: number;
  /** Samples above this stick throttle (%) are unusable. */
  maxThrottle?: number;
  /** Samples where any motor sits at its lowest or highest output are unusable. */
  excludeSaturation?: boolean;
}

export interface MscResponse {
  /** Echoed reboot type (should be 2 for MSC). */
  rebootType: number;
  /**
   * True when the FC accepted the reboot — storage device is ready and the
   * port will drop in a moment. False means SD card / flash isn't present.
   */
  storageReady: boolean;
}

export interface TauriFcPortInfo {
  path: string;
  vendor_id: number;
  product_id: number;
  product: string | null;
  manufacturer: string | null;
}

export interface FcPort {
  /** Send raw bytes to the FC. Resolves once the buffer is queued for writing. */
  write(data: Uint8Array): Promise<void>;

  /**
   * Read up to `len` bytes from the FC. Resolves as soon as that many bytes
   * are available, or rejects after `timeoutMs` if not enough arrived.
   */
  read(len: number, timeoutMs: number): Promise<Uint8Array>;

  /** Close the underlying port. Idempotent. */
  close(): Promise<void>;

  /** Human-readable label of the connected device, for logging. */
  readonly label: string;
}

export interface ParseProgress {
  progress: number;
  rows: number;
}

export type ProgressCallback = (p: ParseProgress) => void;
