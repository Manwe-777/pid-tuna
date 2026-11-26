/**
 * Closed-loop step response per axis, estimated from setpoint → gyro.
 *
 * The log is cut into overlapping Hann-windowed segments. Segments with too
 * little stick input, or whose own step response settles far from the rest,
 * are dropped. The cross-spectrum Σ Y·conj(X) and input power Σ |X|² of the
 * remaining segments are pooled (the H1 estimator), and the impulse response
 * comes from one regularised division of the pooled spectra:
 *
 *   H[k] = Σ Y[k]·conj(X[k]) / (Σ |X[k]|² + λ · mean(Σ |X|²))
 *
 * Pooling before dividing is what keeps the estimate unbiased: averaging
 * per-segment deconvolutions overweights poorly excited segments.
 *
 * The step is left in absolute units, so a drone that settles below setpoint
 * reads below 1. Shape metrics (rise, overshoot, settling, half-way time) are
 * measured relative to that steady-state level.
 */
import FFT from 'fft.js';

interface FFTImpl {
  size: number;
  createComplexArray(): number[];
  realTransform(out: Float64Array | number[], data: ArrayLike<number>): void;
  inverseTransform(out: Float64Array | number[], data: ArrayLike<number>): void;
  completeSpectrum(spectrum: Float64Array | number[]): void;
}

const FFTCtor = FFT as unknown as new (size: number) => FFTImpl;

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
  metrics: StepMetrics;
  diagnostics: StepDiagnostics;
  /** Pooled spectra, kept so results from several logs can be combined. */
  pooled: PooledSpectra | null;
}

export interface PooledSpectra {
  fftSize: number;
  /** Σ Y·conj(X), interleaved re/im, length 2·fftSize. */
  crossSpectrum: Float64Array;
  /** Σ |X|², length fftSize. */
  inputPower: Float64Array;
  regularization: number;
}

export interface StepDiagnostics {
  /** Number of analysis windows the log was sliced into. */
  windowsTotal: number;
  /** Windows skipped because mean |setpoint| was below minExcitation. */
  windowsLowExcitation: number;
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
  /** Time to enter and stay within ±5% of the steady-state level, in ms. */
  settlingTimeMs: number | null;
  /** Time to first reach 50% of the steady-state level, in ms. */
  latencyHalfMs: number | null;
  /** Absolute peak of the response (setpoint = 1). */
  peakResponse: number | null;
  /** Mean level from 200 ms to the end (setpoint = 1). Below 1 means gyro falls short of setpoint. */
  steadyState: number | null;
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
  /** Drop windows whose own steady state is below this. Default 0.5. */
  settleMin?: number;
  /** Drop windows whose own steady state is above this. Default 1.5. */
  settleMax?: number;
  /** Drop windows whose steady state is more than k robust deviations from the median. Default 3. */
  outlierK?: number;
}

export const STEP_DEFAULTS = {
  windowMs: 2000,
  responseMs: 500,
  overlap: 0.75,
  regularization: 0.001,
  minExcitation: 20,
  settleMin: 0.5,
  settleMax: 1.5,
  outlierK: 3,
} as const;

/** Per-window traces are only for screening and display, so they use a steadier, stronger λ. */
const SEGMENT_REGULARIZATION = 0.01;
const STEADY_FROM_MS = 200;

export function computeStepResponse(
  setpoint: Float32Array,
  gyro: Float32Array,
  sampTimeUs: number,
  options: StepResponseOptions = {},
): StepResponseResult {
  const opts = { ...STEP_DEFAULTS, ...options };
  const sampleTimeMs = sampTimeUs / 1000;
  const n = Math.min(setpoint.length, gyro.length);
  if (sampleTimeMs <= 0 || n < 512) return emptyResult();

  const winSamples = Math.max(64, Math.round(opts.windowMs / sampleTimeMs));
  if (winSamples > n) return emptyResult();
  const hopSamples = Math.max(1, Math.round(winSamples * (1 - opts.overlap)));
  const respSamples = Math.max(8, Math.round(opts.responseMs / sampleTimeMs));
  const stepLen = respSamples + 1;
  const fftSize = nextPow2(winSamples * 2);
  const steadyFrom = Math.min(stepLen - 1, Math.round(STEADY_FROM_MS / sampleTimeMs));

  const time = new Float32Array(stepLen);
  for (let i = 0; i < stepLen; i++) time[i] = i * sampleTimeMs;

  let peakSetpoint = 0;
  for (let i = 0; i < n; i++) peakSetpoint = Math.max(peakSetpoint, Math.abs(setpoint[i]!));

  const ctx = makeContext(fftSize, winSamples);
  const starts: number[] = [];
  const traces: Float32Array[] = [];
  const levels: number[] = [];
  let windowsTotal = 0;
  let windowsLowExcitation = 0;

  for (let start = 0; start + winSamples <= n; start += hopSamples) {
    windowsTotal++;

    if (meanAbs(setpoint, start, winSamples) < opts.minExcitation) {
      windowsLowExcitation++;
      continue;
    }

    transformWindow(ctx, setpoint, gyro, start);
    const trace = segmentStep(ctx, stepLen);
    starts.push(start);
    traces.push(trace);
    levels.push(meanOf(trace, steadyFrom, stepLen));
  }

  const keep = screenLevels(levels, opts.settleMin, opts.settleMax, opts.outlierK);
  const segments: Float32Array[] = [];
  const rejectedSegments: Float32Array[] = [];
  const crossSpectrum = new Float64Array(fftSize * 2);
  const inputPower = new Float64Array(fftSize);

  for (let w = 0; w < starts.length; w++) {
    if (!keep[w]) {
      rejectedSegments.push(traces[w]!);
      continue;
    }

    segments.push(traces[w]!);
    transformWindow(ctx, setpoint, gyro, starts[w]!);
    accumulate(ctx, crossSpectrum, inputPower);
  }

  const pooled = segments.length > 0 ? { fftSize, crossSpectrum, inputPower, regularization: opts.regularization } : null;
  const mean = pooled ? stepFromPooled(pooled, stepLen) : new Float32Array(0);
  const pooledLevel = meanOf(mean, steadyFrom, stepLen);
  for (const seg of segments) scaleToLevel(seg, steadyFrom, pooledLevel);

  return {
    time,
    segments,
    rejectedSegments,
    mean,
    metrics: computeMetrics(time, mean, steadyFrom),
    diagnostics: {
      windowsTotal,
      windowsLowExcitation,
      windowsBadSettle: rejectedSegments.length,
      windowsAccepted: segments.length,
      peakSetpoint,
    },
    pooled,
  };
}

/**
 * Combine per-log results by pooling their spectra and re-deriving the step
 * and metrics. Logs whose logging rate is within 2% of the first log merge
 * (flight-controller clocks drift, so nominally equal rates rarely match
 * exactly); logs at a different rate are skipped.
 */
export function combineStepResponses(results: StepResponseResult[]): StepResponseResult {
  if (results.length === 0) return emptyResult();
  if (results.length === 1) return results[0]!;

  const ref = results.find((r) => r.pooled != null) ?? results[0]!;
  const stepLen = ref.time.length;
  if (stepLen === 0 || ref.pooled == null) return ref;

  const { fftSize, regularization } = ref.pooled;
  const crossSpectrum = new Float64Array(fftSize * 2);
  const inputPower = new Float64Array(fftSize);
  const segments: Float32Array[] = [];
  const rejectedSegments: Float32Array[] = [];
  const diagnostics: StepDiagnostics = {
    windowsTotal: 0,
    windowsLowExcitation: 0,
    windowsBadSettle: 0,
    windowsAccepted: 0,
    peakSetpoint: 0,
  };

  for (const r of results) {
    diagnostics.windowsTotal += r.diagnostics.windowsTotal;
    diagnostics.windowsLowExcitation += r.diagnostics.windowsLowExcitation;
    diagnostics.peakSetpoint = Math.max(diagnostics.peakSetpoint, r.diagnostics.peakSetpoint);
    if (r.pooled == null || r.pooled.fftSize !== fftSize || !similarRate(r.time, ref.time)) continue;

    for (let i = 0; i < crossSpectrum.length; i++) crossSpectrum[i] = crossSpectrum[i]! + r.pooled.crossSpectrum[i]!;
    for (let i = 0; i < fftSize; i++) inputPower[i] = inputPower[i]! + r.pooled.inputPower[i]!;
    segments.push(...r.segments.map((seg) => fitLength(seg, stepLen)));
    rejectedSegments.push(...r.rejectedSegments.map((seg) => fitLength(seg, stepLen)));
    diagnostics.windowsAccepted += r.diagnostics.windowsAccepted;
    diagnostics.windowsBadSettle += r.diagnostics.windowsBadSettle;
  }

  const pooled = { fftSize, crossSpectrum, inputPower, regularization };
  const mean = stepFromPooled(pooled, stepLen);
  const sampleTimeMs = stepLen > 1 ? ref.time[1]! : 1;
  const steadyFrom = Math.min(stepLen - 1, Math.round(STEADY_FROM_MS / sampleTimeMs));

  return {
    time: ref.time,
    segments,
    rejectedSegments,
    mean,
    metrics: computeMetrics(ref.time, mean, steadyFrom),
    diagnostics,
    pooled,
  };
}

const MERGE_RATE_TOLERANCE = 0.02;

function similarRate(a: Float32Array, b: Float32Array): boolean {
  if (a.length < 2 || b.length < 2) return false;

  return Math.abs(a[1]! / b[1]! - 1) <= MERGE_RATE_TOLERANCE;
}

function fitLength(trace: Float32Array, len: number): Float32Array {
  if (trace.length === len) return trace;

  const out = new Float32Array(len);
  out.set(trace.subarray(0, len));
  for (let i = trace.length; i < len; i++) out[i] = trace[trace.length - 1]!;

  return out;
}

interface Context {
  fft: FFTImpl;
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

function makeContext(fftSize: number, winSamples: number): Context {
  return {
    fft: new FFTCtor(fftSize),
    fftSize,
    winSamples,
    hann: makeHannWindow(winSamples),
    xPad: new Float64Array(fftSize),
    yPad: new Float64Array(fftSize),
    X: new Float64Array(fftSize * 2),
    Y: new Float64Array(fftSize * 2),
    H: new Float64Array(fftSize * 2),
    h: new Float64Array(fftSize * 2),
  };
}

function transformWindow(ctx: Context, setpoint: Float32Array, gyro: Float32Array, start: number): void {
  ctx.xPad.fill(0);
  ctx.yPad.fill(0);

  for (let i = 0; i < ctx.winSamples; i++) {
    const w = ctx.hann[i]!;
    ctx.xPad[i] = setpoint[start + i]! * w;
    ctx.yPad[i] = gyro[start + i]! * w;
  }

  ctx.fft.realTransform(ctx.X, ctx.xPad);
  ctx.fft.completeSpectrum(ctx.X);
  ctx.fft.realTransform(ctx.Y, ctx.yPad);
  ctx.fft.completeSpectrum(ctx.Y);
}

function accumulate(ctx: Context, crossSpectrum: Float64Array, inputPower: Float64Array): void {
  const { X, Y } = ctx;

  for (let k = 0; k < ctx.fftSize; k++) {
    const xr = X[2 * k]!;
    const xi = X[2 * k + 1]!;
    const yr = Y[2 * k]!;
    const yi = Y[2 * k + 1]!;
    crossSpectrum[2 * k] = crossSpectrum[2 * k]! + yr * xr + yi * xi;
    crossSpectrum[2 * k + 1] = crossSpectrum[2 * k + 1]! + yi * xr - yr * xi;
    inputPower[k] = inputPower[k]! + xr * xr + xi * xi;
  }
}

function segmentStep(ctx: Context, stepLen: number): Float32Array {
  const cross = new Float64Array(ctx.fftSize * 2);
  const power = new Float64Array(ctx.fftSize);
  accumulate(ctx, cross, power);

  return deconvolve(ctx, cross, power, relativeLambda(power, SEGMENT_REGULARIZATION), stepLen);
}

function stepFromPooled(pooled: PooledSpectra, stepLen: number): Float32Array {
  const ctx = makeContext(pooled.fftSize, 0);
  const lambda = relativeLambda(pooled.inputPower, pooled.regularization);

  return deconvolve(ctx, pooled.crossSpectrum, pooled.inputPower, lambda, stepLen);
}

function relativeLambda(power: Float64Array, regularization: number): number {
  let sum = 0;
  for (let k = 0; k < power.length; k++) sum += power[k]!;

  return (regularization * sum) / power.length;
}

function deconvolve(
  ctx: Context,
  cross: Float64Array,
  power: Float64Array,
  lambda: number,
  stepLen: number,
): Float32Array {
  const N = ctx.fftSize;

  for (let k = 0; k < N; k++) {
    const den = power[k]! + lambda;
    ctx.H[2 * k] = den > 0 ? cross[2 * k]! / den : 0;
    ctx.H[2 * k + 1] = den > 0 ? cross[2 * k + 1]! / den : 0;
  }

  ctx.fft.inverseTransform(ctx.h, ctx.H);

  const step = new Float32Array(stepLen);
  let acc = 0;

  for (let i = 0; i < stepLen; i++) {
    acc += ctx.h[2 * i]!;
    step[i] = acc;
  }

  return step;
}

/** Keep windows inside the settle band and within k robust deviations of the median level. */
function screenLevels(levels: number[], settleMin: number, settleMax: number, k: number): boolean[] {
  const inBand = levels.map((l) => Number.isFinite(l) && l >= settleMin && l <= settleMax);
  const banded = levels.filter((_l, i) => inBand[i]);
  if (banded.length < 3) return inBand;

  const center = median(banded);
  const spread = 1.4826 * median(banded.map((l) => Math.abs(l - center)));
  if (!(spread > 0)) return inBand;

  return levels.map((l, i) => inBand[i]! && Math.abs(l - center) <= k * spread);
}

function emptyResult(): StepResponseResult {
  return {
    time: new Float32Array(0),
    segments: [],
    rejectedSegments: [],
    mean: new Float32Array(0),
    metrics: nullMetrics(),
    diagnostics: {
      windowsTotal: 0,
      windowsLowExcitation: 0,
      windowsBadSettle: 0,
      windowsAccepted: 0,
      peakSetpoint: 0,
    },
    pooled: null,
  };
}

function nullMetrics(): StepMetrics {
  return {
    riseTimeMs: null,
    overshootPct: null,
    settlingTimeMs: null,
    latencyHalfMs: null,
    peakResponse: null,
    steadyState: null,
  };
}

function computeMetrics(time: Float32Array, step: Float32Array, steadyFrom: number): StepMetrics {
  if (step.length < 2) return nullMetrics();

  const steadyState = meanOf(step, steadyFrom, step.length);
  if (!(steadyState > 0.05)) return { ...nullMetrics(), steadyState: Number.isFinite(steadyState) ? steadyState : null };

  let peak = -Infinity;
  for (let i = 0; i < step.length; i++) peak = Math.max(peak, step[i]!);

  const t10 = firstCrossing(time, step, 0.1 * steadyState);
  const t90 = firstCrossing(time, step, 0.9 * steadyState);

  return {
    riseTimeMs: t10 != null && t90 != null && t90 >= t10 ? t90 - t10 : null,
    overshootPct: peak > steadyState ? (peak / steadyState - 1) * 100 : 0,
    settlingTimeMs: settlingTime(time, step, steadyState),
    latencyHalfMs: firstCrossing(time, step, 0.5 * steadyState),
    peakResponse: peak,
    steadyState,
  };
}

function settlingTime(time: Float32Array, step: Float32Array, steadyState: number): number | null {
  for (let i = step.length - 1; i >= 0; i--) {
    if (Math.abs(step[i]! / steadyState - 1) > 0.05) return i + 1 < step.length ? time[i + 1]! : null;
  }

  return time[0]!;
}

function firstCrossing(time: Float32Array, signal: Float32Array, target: number): number | null {
  for (let i = 1; i < signal.length; i++) {
    const a = signal[i - 1]!;
    const b = signal[i]!;

    if (a < target && b >= target) {
      const frac = (target - a) / (b - a);

      return time[i - 1]! + frac * (time[i]! - time[i - 1]!);
    }
  }

  return null;
}

function scaleToLevel(trace: Float32Array, from: number, level: number): void {
  const own = meanOf(trace, from, trace.length);
  if (!(Math.abs(own) > 1e-6) || !Number.isFinite(level)) return;

  const k = level / own;
  for (let i = 0; i < trace.length; i++) trace[i] = trace[i]! * k;
}

function meanAbs(x: Float32Array, start: number, len: number): number {
  let s = 0;
  for (let i = 0; i < len; i++) s += Math.abs(x[start + i]!);

  return s / len;
}

function meanOf(x: Float32Array, from: number, to: number): number {
  let s = 0;
  for (let i = from; i < to; i++) s += x[i]!;

  return to > from ? s / (to - from) : Number.NaN;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;

  return s.length % 2 ? s[m]! : 0.5 * (s[m - 1]! + s[m]!);
}

function makeHannWindow(n: number): Float64Array {
  const out = new Float64Array(n);
  if (n < 2) {
    if (n === 1) out[0] = 1;

    return out;
  }

  for (let i = 0; i < n; i++) out[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));

  return out;
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;

  return p;
}
