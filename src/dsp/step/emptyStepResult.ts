import type { StepResponseResult } from '../../types';
import { emptyStepDiagnostics } from './emptyStepDiagnostics';
import { nullStepMetrics } from './nullStepMetrics';

export function emptyStepResult(): StepResponseResult {
  return {
    time: new Float32Array(0),
    segments: [],
    rejectedSegments: [],
    mean: new Float32Array(0),
    spread: new Float32Array(0),
    frequency: null,
    metricSpread: {},
    metrics: nullStepMetrics(),
    diagnostics: emptyStepDiagnostics(),
    pooled: null,
  };
}
