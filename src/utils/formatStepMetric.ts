import type { StepMetricOption } from '../types';

export function formatStepMetric(option: StepMetricOption, value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';

  return option.unit ? `${value.toFixed(option.digits)} ${option.unit}` : value.toFixed(option.digits);
}
