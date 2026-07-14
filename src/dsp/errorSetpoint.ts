/**
 * "Error vs Setpoint" 2D density — a Blackbox-Explorer-style view of tracking
 * quality. Each sample contributes to a bin at (setpoint, error) where
 * error = setpoint − gyro (deg/s). A perfect tracker sits on the error = 0 line
 * across the whole setpoint range; overshoot / lag show as the cloud bending
 * away from zero at the stick extremes. Colour encodes log sample density.
 */

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
  xBins: number;
  yBins: number;
  /** Symmetric half-ranges actually used. */
  setpointRange: number;
  errorRange: number;
  /** Whether any samples landed in the grid. */
  sampleCount: number;
}

/** 99.5th-percentile of |values|, so a few spikes don't stretch the axis. */
function robustAbsMax(values: Float32Array): number {
  let count = 0;
  for (let i = 0; i < values.length; i++) if (Number.isFinite(values[i]!)) count++;
  if (count === 0) return 1;
  const abs = new Float64Array(count);
  let j = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    if (Number.isFinite(v)) abs[j++] = Math.abs(v);
  }
  abs.sort();
  const p = abs[Math.min(abs.length - 1, Math.floor(abs.length * 0.995))]!;
  return p > 0 ? p : 1;
}

export function computeErrorSetpointDensity(
  setpoint: Float32Array,
  gyro: Float32Array,
  options: ErrorSetpointOptions = {},
): ErrorSetpointResult {
  const xBins = options.xBins ?? 120;
  const yBins = options.yBins ?? 120;

  const n = Math.min(setpoint.length, gyro.length);

  const empty = (): ErrorSetpointResult => ({
    xCenters: new Float32Array(0),
    yCenters: new Float32Array(0),
    density: new Float32Array(0),
    xBins,
    yBins,
    setpointRange: options.setpointRange ?? 1,
    errorRange: options.errorRange ?? 1,
    sampleCount: 0,
  });

  if (n === 0) return empty();

  // Error series.
  const error = new Float32Array(n);
  for (let i = 0; i < n; i++) error[i] = setpoint[i]! - gyro[i]!;

  const spRange = options.setpointRange ?? robustAbsMax(setpoint.subarray(0, n));
  const errRange = options.errorRange ?? robustAbsMax(error);
  if (!(spRange > 0) || !(errRange > 0)) return empty();

  const counts = new Float64Array(xBins * yBins);
  const xScale = xBins / (2 * spRange);
  const yScale = yBins / (2 * errRange);
  let sampleCount = 0;

  for (let i = 0; i < n; i++) {
    const sp = setpoint[i]!;
    const er = error[i]!;
    if (!Number.isFinite(sp) || !Number.isFinite(er)) continue;
    let xb = Math.floor((sp + spRange) * xScale);
    let yb = Math.floor((er + errRange) * yScale);
    if (xb < 0 || xb >= xBins || yb < 0 || yb >= yBins) continue; // outside clamp range
    const idx = yb * xBins + xb;
    counts[idx] = counts[idx]! + 1;
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

  const xCenters = new Float32Array(xBins);
  const xStep = (2 * spRange) / xBins;
  for (let i = 0; i < xBins; i++) xCenters[i] = -spRange + (i + 0.5) * xStep;
  const yCenters = new Float32Array(yBins);
  const yStep = (2 * errRange) / yBins;
  for (let i = 0; i < yBins; i++) yCenters[i] = -errRange + (i + 0.5) * yStep;

  return {
    xCenters,
    yCenters,
    density,
    xBins,
    yBins,
    setpointRange: spRange,
    errorRange: errRange,
    sampleCount,
  };
}
