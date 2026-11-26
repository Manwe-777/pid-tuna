import type { StepMetrics, StepResponseResult } from '../types';
import { emptyDiagnostics } from './emptyStepDiagnostics';
import { metricSpread } from './stepMetricSpread';

export function emptyResult(): StepResponseResult {
  return {
    time: new Float32Array(0),
    segments: [],
    rejectedSegments: [],
    mean: new Float32Array(0),
    spread: new Float32Array(0),
    frequency: null,
    metricSpread: {},
    metrics: nullMetrics(),
    diagnostics: emptyDiagnostics(),
    pooled: null,
  };
}

export function nullMetrics(): StepMetrics {
  return {
    riseTimeMs: null,
    overshootPct: null,
    peakTimeMs: null,
    settlingTimeMs: null,
    latencyHalfMs: null,
    peakResponse: null,
    steadyState: null,
    bandwidthHz: null,
    sensitivityPeakDb: null,
    sensitivityPeakHz: null,
    confidence: null,
    crossoverHz: null,
    phaseMarginDeg: null,
  };
}
