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
