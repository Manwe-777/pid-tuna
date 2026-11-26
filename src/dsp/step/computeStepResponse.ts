import { MIN_USABLE_FRACTION, STEP_DEFAULTS } from '../../constants';
import type { StepDiagnostics, StepResponseOptions, StepResponseResult } from '../../types';
import { meanAbs } from '../../utils/meanAbs';
import { meanOf } from '../../utils/meanOf';
import { nextPow2 } from '../../utils/nextPow2';
import { accumulateSpectra } from './accumulateSpectra';
import { emptyStepDiagnostics } from './emptyStepDiagnostics';
import { emptyStepResult } from './emptyStepResult';
import { emptyStepSpectra } from './emptyStepSpectra';
import { finishStepResponse } from './finishStepResponse';
import { makeStepFftContext } from './makeStepFftContext';
import { screenLevels } from './screenLevels';
import { segmentStep } from './segmentStep';
import { steadyIndex } from './steadyIndex';
import { transformWindow } from './transformWindow';
import { usableFraction } from './usableFraction';

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
  if (sampleTimeMs <= 0 || n < 512) return emptyStepResult();

  const winSamples = Math.max(64, Math.round(opts.windowMs / sampleTimeMs));
  if (winSamples > n) return emptyStepResult();
  const hopSamples = Math.max(1, Math.round(winSamples * (1 - opts.overlap)));
  const respSamples = Math.max(8, Math.round(opts.responseMs / sampleTimeMs));
  const stepLen = respSamples + 1;
  const fftSize = nextPow2(winSamples * 2);
  const steadyFrom = steadyIndex(sampleTimeMs, stepLen);

  const time = stepTimeAxis(stepLen, sampleTimeMs);
  const peakSetpoint = peakAbs(setpoint, n);

  const ctx = makeStepFftContext(fftSize, winSamples);
  const starts: number[] = [];
  const traces: Float32Array[] = [];
  const levels: number[] = [];
  const diagnostics = emptyStepDiagnostics();
  diagnostics.peakSetpoint = peakSetpoint;

  for (let start = 0; start + winSamples <= n; start += hopSamples) {
    if (!windowIsUsable(setpoint, start, winSamples, opts, diagnostics)) continue;

    transformWindow(ctx, setpoint, gyro, start);
    const trace = segmentStep(ctx, stepLen);
    starts.push(start);
    traces.push(trace);
    levels.push(meanOf(trace, steadyFrom, stepLen));
  }

  const keep = screenLevels(levels, opts.settleMin, opts.settleMax, opts.outlierK);
  const segments: Float32Array[] = [];
  const rejectedSegments: Float32Array[] = [];
  const spectra = emptyStepSpectra(fftSize, sampleTimeMs, opts.regularization);

  for (let w = 0; w < starts.length; w++) {
    if (!keep[w]) {
      rejectedSegments.push(traces[w]!);
      continue;
    }

    segments.push(traces[w]!);
    transformWindow(ctx, setpoint, gyro, starts[w]!);
    accumulateSpectra(ctx, spectra);
  }

  diagnostics.windowsBadSettle = rejectedSegments.length;
  diagnostics.windowsAccepted = segments.length;

  return finishStepResponse(time, segments, rejectedSegments, segments.length > 0 ? spectra : null, diagnostics);
}

function stepTimeAxis(stepLen: number, sampleTimeMs: number): Float32Array {
  const time = new Float32Array(stepLen);
  for (let i = 0; i < stepLen; i++) time[i] = i * sampleTimeMs;

  return time;
}

function peakAbs(x: Float32Array, n: number): number {
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(x[i]!));

  return peak;
}

/**
 * Counts the window in `diagnostics` and reports whether it has the right
 * amount of stick input and enough usable samples; a rejected window is
 * counted under its reason.
 */
function windowIsUsable(
  setpoint: Float32Array,
  start: number,
  winSamples: number,
  opts: Pick<StepResponseOptions, 'mask'> & { minExcitation: number; maxExcitation: number },
  diagnostics: StepDiagnostics,
): boolean {
  diagnostics.windowsTotal++;

  const excitation = meanAbs(setpoint, start, winSamples);

  if (excitation < opts.minExcitation) {
    diagnostics.windowsLowExcitation++;

    return false;
  }

  if (excitation > opts.maxExcitation) {
    diagnostics.windowsHighExcitation++;

    return false;
  }

  if (opts.mask && usableFraction(opts.mask, start, winSamples) < MIN_USABLE_FRACTION) {
    diagnostics.windowsMasked++;

    return false;
  }

  return true;
}
