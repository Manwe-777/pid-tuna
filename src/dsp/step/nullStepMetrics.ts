import type { StepMetrics } from '../../types';

export function nullStepMetrics(): StepMetrics {
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
