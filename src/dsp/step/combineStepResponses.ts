import type { StepResponseResult } from '../../types';
import { addSpectra } from './addSpectra';
import { emptyStepDiagnostics } from './emptyStepDiagnostics';
import { emptyStepResult } from './emptyStepResult';
import { emptyStepSpectra } from './emptyStepSpectra';
import { finishStepResponse } from './finishStepResponse';
import { fitLength } from './fitLength';
import { similarRate } from './similarRate';

/**
 * Combine per-log results by pooling their spectra and re-deriving the step
 * and metrics. Logs whose logging rate is within 2% of the first log merge
 * (flight-controller clocks drift, so nominally equal rates rarely match
 * exactly); logs at a different rate are skipped.
 */
export function combineStepResponses(results: StepResponseResult[]): StepResponseResult {
  if (results.length === 0) return emptyStepResult();
  if (results.length === 1) return results[0]!;

  const ref = results.find((r) => r.pooled != null) ?? results[0]!;
  const stepLen = ref.time.length;
  if (stepLen === 0 || ref.pooled == null) return ref;

  const spectra = emptyStepSpectra(ref.pooled.fftSize, ref.pooled.sampleTimeMs, ref.pooled.regularization);
  const segments: Float32Array[] = [];
  const rejectedSegments: Float32Array[] = [];
  const diagnostics = emptyStepDiagnostics();

  for (const r of results) {
    diagnostics.windowsTotal += r.diagnostics.windowsTotal;
    diagnostics.windowsLowExcitation += r.diagnostics.windowsLowExcitation;
    diagnostics.windowsHighExcitation += r.diagnostics.windowsHighExcitation;
    diagnostics.windowsMasked += r.diagnostics.windowsMasked;
    diagnostics.peakSetpoint = Math.max(diagnostics.peakSetpoint, r.diagnostics.peakSetpoint);
    if (r.pooled == null || r.pooled.fftSize !== spectra.fftSize || !similarRate(r.time, ref.time)) continue;

    addSpectra(spectra, r.pooled);
    segments.push(...r.segments.map((seg) => fitLength(seg, stepLen)));
    rejectedSegments.push(...r.rejectedSegments.map((seg) => fitLength(seg, stepLen)));
    diagnostics.windowsAccepted += r.diagnostics.windowsAccepted;
    diagnostics.windowsBadSettle += r.diagnostics.windowsBadSettle;
  }

  return finishStepResponse(ref.time, segments, rejectedSegments, spectra, diagnostics);
}
