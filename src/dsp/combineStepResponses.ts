import type { StepResponseResult } from '../types';
import { emptyDiagnostics } from './emptyStepDiagnostics';
import { emptyResult } from './emptyStepResult';
import { emptySpectra } from './emptyStepSpectra';
import { finish } from './stepFinish';
import type { StepSpectra } from './stepFrequencyResponse';

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

  const spectra = emptySpectra(ref.pooled.fftSize, ref.pooled.sampleTimeMs, ref.pooled.regularization);
  const segments: Float32Array[] = [];
  const rejectedSegments: Float32Array[] = [];
  const diagnostics = emptyDiagnostics();

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

  return finish(ref.time, segments, rejectedSegments, spectra, diagnostics);
}

export const MERGE_RATE_TOLERANCE = 0.02;

export function similarRate(a: Float32Array, b: Float32Array): boolean {
  if (a.length < 2 || b.length < 2) return false;

  return Math.abs(a[1]! / b[1]! - 1) <= MERGE_RATE_TOLERANCE;
}

export function fitLength(trace: Float32Array, len: number): Float32Array {
  if (trace.length === len) return trace;

  const out = new Float32Array(len);
  out.set(trace.subarray(0, len));
  for (let i = trace.length; i < len; i++) out[i] = trace[trace.length - 1]!;

  return out;
}

export function addSpectra(into: StepSpectra, from: StepSpectra): void {
  for (let i = 0; i < into.crossSpectrum.length; i++)
    into.crossSpectrum[i] = into.crossSpectrum[i]! + from.crossSpectrum[i]!;

  for (let i = 0; i < into.fftSize; i++) {
    into.inputPower[i] = into.inputPower[i]! + from.inputPower[i]!;
    into.outputPower[i] = into.outputPower[i]! + from.outputPower[i]!;
  }
}
