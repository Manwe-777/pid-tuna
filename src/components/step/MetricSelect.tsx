import { STEP_METRICS } from '../../constants';
import type { StepMetrics } from '../../types';

export function MetricSelect({
  value,
  onChange,
}: {
  value: keyof StepMetrics;
  onChange: (k: keyof StepMetrics) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as keyof StepMetrics)}>
      {STEP_METRICS.map((m) => (
        <option key={m.key} value={m.key}>
          {m.label}
        </option>
      ))}
    </select>
  );
}
