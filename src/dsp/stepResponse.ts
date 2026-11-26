import { STEP_DEFAULTS } from '../constants';
import type { StepFftContext, StepResponseOptions, StepResponseResult } from '../types';
import { meanAbs } from '../utils/meanAbs';
import { meanOf } from '../utils/meanOf';
import { median } from '../utils/median';
import { nextPow2 } from '../utils/nextPow2';
import { accumulate } from './accumulateStepSpectra';
import { emptyDiagnostics } from './emptyStepDiagnostics';
import { emptyResult } from './emptyStepResult';
import { emptySpectra } from './emptyStepSpectra';
import { makeContext } from './stepFftContext';
import { finish } from './stepFinish';
import { segmentStep } from './stepSegmentStep';
import { steadyIndex } from './stepSteadyIndex';

export const MIN_USABLE_FRACTION = 0.9;

/**
 * Closed-loop step response per axis, estimated from setpoint → gyro.
 *
 * The log is cut into overlapping Hann-windowed segments. Segments with too
 * little (or too much) stick input, with too many unusable samples (ground,
 * idle, saturated motors), or whose own step settles far from the rest are
 * dropped. The cross-spectrum Σ Y·conj(X) and input power Σ |X|² of the
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
  const steadyFrom = steadyIndex(sampleTimeMs, stepLen);

  const time = new Float32Array(stepLen);
  for (let i = 0; i < stepLen; i++) time[i] = i * sampleTimeMs;

  let peakSetpoint = 0;
  for (let i = 0; i < n; i++) peakSetpoint = Math.max(peakSetpoint, Math.abs(setpoint[i]!));

  const ctx = makeContext(fftSize, winSamples);
  const starts: number[] = [];
  const traces: Float32Array[] = [];
  const levels: number[] = [];
  const diagnostics = emptyDiagnostics();
  diagnostics.peakSetpoint = peakSetpoint;

  for (let start = 0; start + winSamples <= n; start += hopSamples) {
    diagnostics.windowsTotal++;

    const excitation = meanAbs(setpoint, start, winSamples);

    if (excitation < opts.minExcitation) {
      diagnostics.windowsLowExcitation++;
      continue;
    }

    if (excitation > opts.maxExcitation) {
      diagnostics.windowsHighExcitation++;
      continue;
    }

    if (opts.mask && usableFraction(opts.mask, start, winSamples) < MIN_USABLE_FRACTION) {
      diagnostics.windowsMasked++;
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
  const spectra = emptySpectra(fftSize, sampleTimeMs, opts.regularization);

  for (let w = 0; w < starts.length; w++) {
    if (!keep[w]) {
      rejectedSegments.push(traces[w]!);
      continue;
    }

    segments.push(traces[w]!);
    transformWindow(ctx, setpoint, gyro, starts[w]!);
    accumulate(ctx, spectra);
  }

  diagnostics.windowsBadSettle = rejectedSegments.length;
  diagnostics.windowsAccepted = segments.length;

  return finish(time, segments, rejectedSegments, segments.length > 0 ? spectra : null, diagnostics);
}

export function transformWindow(ctx: StepFftContext, setpoint: Float32Array, gyro: Float32Array, start: number): void {
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

/** Keep windows inside the settle band and within k robust deviations of the median level. */
export function screenLevels(levels: number[], settleMin: number, settleMax: number, k: number): boolean[] {
  const inBand = levels.map((l) => Number.isFinite(l) && l >= settleMin && l <= settleMax);
  const banded = levels.filter((_l, i) => inBand[i]);
  if (banded.length < 3) return inBand;

  const center = median(banded);
  const spread = 1.4826 * median(banded.map((l) => Math.abs(l - center)));
  if (!(spread > 0)) return inBand;

  return levels.map((l, i) => inBand[i]! && Math.abs(l - center) <= k * spread);
}

export function usableFraction(mask: Uint8Array, start: number, len: number): number {
  let ok = 0;
  for (let i = 0; i < len; i++) ok += mask[start + i] ?? 0;

  return ok / len;
}
