import type { ErrorSetpointInput, ErrorSetpointOptions, ErrorSetpointResult } from '../types';

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
  const empty = () => emptyResult(xBins, yBins, options);

  if (sp.length === 0) return empty();

  const { spRange, errRange } = axisRanges(sp, er, options);
  if (!(spRange > 0) || !(errRange > 0)) return empty();

  const { counts, colSum, colN, sampleCount } = binPairs(sp, er, xBins, yBins, spRange, errRange);
  if (sampleCount === 0) return empty();

  const xStep = (2 * spRange) / xBins;
  const yStep = (2 * errRange) / yBins;

  return {
    xCenters: Float32Array.from({ length: xBins }, (_, i) => -spRange + (i + 0.5) * xStep),
    yCenters: Float32Array.from({ length: yBins }, (_, i) => -errRange + (i + 0.5) * yStep),
    density: logDensity(counts),
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

/** Half-widths of the setpoint and error axes: the given ones, or robust maxima of the data. */
function axisRanges(sp: number[], er: number[], options: ErrorSetpointOptions) {
  return {
    spRange: options.setpointRange ?? robustAbsMax(sp),
    errRange: options.errorRange ?? robustAbsMax(er),
  };
}

function emptyResult(xBins: number, yBins: number, options: ErrorSetpointOptions): ErrorSetpointResult {
  return {
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
  };
}

/** 2D histogram of (setpoint, error) plus each setpoint column's error sum and count. */
function binPairs(sp: number[], er: number[], xBins: number, yBins: number, spRange: number, errRange: number) {
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

  return { counts, colSum, colN, sampleCount };
}

/** Log-compress and normalize to [0,1] for the colormap. */
function logDensity(counts: Float64Array): Float32Array {
  const density = new Float32Array(counts.length);
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

  return density;
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
