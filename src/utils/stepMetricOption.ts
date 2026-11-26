import { STEP_METRICS } from '../constants';
import type { StepMetricOption, StepMetrics } from '../types';

export function stepMetricOption(key: keyof StepMetrics): StepMetricOption {
  return STEP_METRICS.find((m) => m.key === key) ?? STEP_METRICS[0]!;
}
