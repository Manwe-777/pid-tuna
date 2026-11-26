import type { StepDiagnostics, StepResponseResult } from '../types';
import { meanOf } from '../utils/meanOf';
import { deconvolve } from './stepDeconvolve';
import { makeContext } from './stepFftContext';
import { relativeLambda, stepFrequencyResponse, type StepSpectra } from './stepFrequencyResponse';
import { metricSpread } from './stepMetricSpread';
import { steadyIndex } from './stepSteadyIndex';
import { timeMetrics } from './stepTimeMetrics';

export function finish(
  time: Float32Array,
  segments: Float32Array[],
  rejectedSegments: Float32Array[],
  spectra: StepSpectra | null,
  diagnostics: StepDiagnostics,
): StepResponseResult {
  const stepLen = time.length;
  const sampleTimeMs = stepLen > 1 ? time[1]! : 1;
  const steadyFrom = steadyIndex(sampleTimeMs, stepLen);
  const mean = spectra ? stepFromSpectra(spectra, stepLen) : new Float32Array(0);
  const level = meanOf(mean, steadyFrom, stepLen);
  for (const seg of segments) scaleToLevel(seg, steadyFrom, level);

  const freq = spectra ? stepFrequencyResponse(spectra) : null;

  return {
    time,
    segments,
    rejectedSegments,
    mean,
    spread: spreadAround(segments, mean),
    frequency: freq?.response ?? null,
    metricSpread: metricSpread(time, segments, steadyFrom),
    metrics: {
      ...timeMetrics(time, mean, steadyFrom),
      bandwidthHz: freq?.metrics.bandwidthHz ?? null,
      sensitivityPeakDb: freq?.metrics.sensitivityPeakDb ?? null,
      sensitivityPeakHz: freq?.metrics.sensitivityPeakHz ?? null,
      confidence: freq?.metrics.confidence ?? null,
      crossoverHz: freq?.metrics.crossoverHz ?? null,
      phaseMarginDeg: freq?.metrics.phaseMarginDeg ?? null,
    },
    diagnostics,
    pooled: spectra,
  };
}

export function stepFromSpectra(s: StepSpectra, stepLen: number): Float32Array {
  const ctx = makeContext(s.fftSize, 0);

  return deconvolve(ctx, s.crossSpectrum, s.inputPower, relativeLambda(s.inputPower, s.regularization), stepLen);
}

export function spreadAround(segments: Float32Array[], mean: Float32Array): Float32Array {
  const out = new Float32Array(mean.length);
  if (segments.length < 2) return out;

  for (const seg of segments) {
    for (let i = 0; i < mean.length; i++) {
      const d = seg[i]! - mean[i]!;
      out[i] = out[i]! + d * d;
    }
  }

  for (let i = 0; i < out.length; i++) out[i] = Math.sqrt(out[i]! / segments.length);

  return out;
}

export function scaleToLevel(trace: Float32Array, from: number, level: number): void {
  const own = meanOf(trace, from, trace.length);
  if (!(Math.abs(own) > 1e-6) || !Number.isFinite(level)) return;

  const k = level / own;
  for (let i = 0; i < trace.length; i++) trace[i] = trace[i]! * k;
}
