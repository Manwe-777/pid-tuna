/**
 * "Error vs Setpoint" 2D density — a Blackbox-Explorer-style view of tracking
 * quality. Each sample contributes to a bin at (setpoint, error) where
 * error = setpoint − gyro (deg/s). A perfect tracker sits on the error = 0 line
 * across the whole setpoint range; falling short at high rates shows as the
 * cloud tilting upward to the right. Colour encodes log sample density.
 *
 * With lag compensation, error = setpoint(t) − gyro(t + lag): the pure delay
 * between stick and gyro is removed, so fast stick moves no longer read as
 * error and what remains is how well gyro reaches setpoint.
 */

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

/** A setpoint bin needs this share of the samples (and at least MIN_BIN_SAMPLES) to get a mean-error point. */
const MIN_BIN_SHARE = 0.002;
const MIN_BIN_SAMPLES = 50;

/** 99.5th-percentile of |values|, so a few spikes don't stretch the axis. */
function robustAbsMax(values: number[]): number {
  if (values.length === 0) return 1;
  const abs = Float64Array.from(values, Math.abs).sort();
  const p = abs[Math.min(abs.length - 1, Math.floor(abs.length * 0.995))]!;

  return p > 0 ? p : 1;
}

export function computeErrorSetpointDensity(
  inputs: ErrorSetpointInput | ErrorSetpointInput[],
  options: ErrorSetpointOptions = {},
): ErrorSetpointResult {
  const xBins = options.xBins ?? 120;
  const yBins = options.yBins ?? 120;
  const { sp, er } = pairs(Array.isArray(inputs) ? inputs : [inputs]);

  const empty = (): ErrorSetpointResult => ({
    xCenters: new Float32Array(0),
    yCenters: new Float32Array(0),
    density: new Float32Array(0),
    meanError: new Float32Array(0),
    xBins,
    yBins,
    setpointRange: options.setpointRange ?? 1,
    errorRange: options.errorRange ?? 1,
    sampleCount: 0,
    rmsError: null,
    trackingSlope: null,
  });

  if (sp.length === 0) return empty();

  const spRange = options.setpointRange ?? robustAbsMax(sp);
  const errRange = options.errorRange ?? robustAbsMax(er);
  if (!(spRange > 0) || !(errRange > 0)) return empty();

  const counts = new Float64Array(xBins * yBins);
  const colSum = new Float64Array(xBins);
  const colN = new Float64Array(xBins);
  const xScale = xBins / (2 * spRange);
  const yScale = yBins / (2 * errRange);
  let sampleCount = 0;

  for (let i = 0; i < sp.length; i++) {
    const xb = edgeInclusive(Math.floor((sp[i]! + spRange) * xScale), xBins);
    const yb = edgeInclusive(Math.floor((er[i]! + errRange) * yScale), yBins);
    if (xb < 0 || yb < 0) continue;

    counts[yb * xBins + xb] = counts[yb * xBins + xb]! + 1;
    colSum[xb] = colSum[xb]! + er[i]!;
    colN[xb] = colN[xb]! + 1;
    sampleCount++;
  }

  if (sampleCount === 0) return empty();

  // Log-compress and normalize to [0,1] for the colormap.
  const density = new Float32Array(xBins * yBins);
  let maxLog = 0;
  for (let i = 0; i < counts.length; i++) {
    const l = Math.log1p(counts[i]!);
    density[i] = l;
    if (l > maxLog) maxLog = l;
  }
  if (maxLog > 0) {
    const inv = 1 / maxLog;
    for (let i = 0; i < density.length; i++) density[i] = density[i]! * inv;
  }

  const xStep = (2 * spRange) / xBins;
  const yStep = (2 * errRange) / yBins;

  return {
    xCenters: Float32Array.from({ length: xBins }, (_, i) => -spRange + (i + 0.5) * xStep),
    yCenters: Float32Array.from({ length: yBins }, (_, i) => -errRange + (i + 0.5) * yStep),
    density,
    meanError: Float32Array.from(colSum, (s, i) =>
      colN[i]! >= Math.max(MIN_BIN_SAMPLES, MIN_BIN_SHARE * sampleCount) ? s / colN[i]! : Number.NaN,
    ),
    xBins,
    yBins,
    setpointRange: spRange,
    errorRange: errRange,
    sampleCount,
    ...summary(sp, er),
  };
}

/** Usable (setpoint, error) pairs from every input, with each input's own lag applied. */
function pairs(inputs: ErrorSetpointInput[]): { sp: number[]; er: number[] } {
  const sp: number[] = [];
  const er: number[] = [];

  for (const { setpoint, gyro, mask, lagSamples = 0 } of inputs) {
    const lag = Math.max(0, Math.round(lagSamples));
    const n = Math.min(setpoint.length, gyro.length - lag);

    for (let i = 0; i < n; i++) {
      if (mask && !(mask[i] && mask[i + lag])) continue;

      const s = setpoint[i]!;
      const e = s - gyro[i + lag]!;
      if (Number.isFinite(s) && Number.isFinite(e)) {
        sp.push(s);
        er.push(e);
      }
    }
  }

  return { sp, er };
}

/** A value exactly at the upper edge belongs in the last bin; anything beyond is dropped. */
function edgeInclusive(bin: number, bins: number): number {
  if (bin === bins) return bins - 1;

  return bin >= 0 && bin < bins ? bin : -1;
}

function summary(sp: number[], er: number[]): { rmsError: number | null; trackingSlope: number | null } {
  const n = sp.length;
  if (n < 2) return { rmsError: null, trackingSlope: null };

  let ss = 0;
  let ms = 0;
  let me = 0;
  for (let i = 0; i < n; i++) {
    ss += er[i]! * er[i]!;
    ms += sp[i]!;
    me += er[i]!;
  }
  ms /= n;
  me /= n;

  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (sp[i]! - ms) * (er[i]! - me);
    sxx += (sp[i]! - ms) ** 2;
  }

  return { rmsError: Math.sqrt(ss / n), trackingSlope: sxx > 0 ? sxy / sxx : null };
}
