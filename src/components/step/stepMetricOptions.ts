import type { StepMetrics } from '../../dsp/stepResponse';

export interface StepMetricOption {
  key: keyof StepMetrics;
  label: string;
  unit: string;
  digits: number;
  help: string;
  /** Reference line for dot plots (e.g. 1 for levels). */
  reference?: number;
  /** Range the dot-plot axis always shows, so a single dot isn't blown up. */
  axis?: [number, number];
}

export const STEP_METRICS: readonly StepMetricOption[] = [
  { key: 'riseTimeMs', label: 'Rise', unit: 'ms', digits: 1, help: 'Time from 10% to 90% of the settled level', axis: [0, 40] },
  { key: 'latencyHalfMs', label: '50%', unit: 'ms', digits: 1, help: 'Time to reach half of the settled level', axis: [0, 20] },
  { key: 'peakTimeMs', label: 'Peak at', unit: 'ms', digits: 1, help: 'Time of the highest point', axis: [0, 60] },
  { key: 'overshootPct', label: 'Overshoot', unit: '%', digits: 1, help: 'How far the peak goes past the settled level', axis: [0, 30] },
  { key: 'peakResponse', label: 'Peak', unit: '', digits: 2, help: 'Highest point, in setpoint units', reference: 1, axis: [0, 1.5] },
  { key: 'settlingTimeMs', label: 'Settle', unit: 'ms', digits: 0, help: 'Time to stay within ±5% of the settled level', axis: [0, 200] },
  { key: 'steadyState', label: 'Level', unit: '', digits: 2, help: 'Settled level relative to setpoint; below 1 means gyro falls short', reference: 1, axis: [0, 1.5] },
  { key: 'bandwidthHz', label: 'Bandwidth', unit: 'Hz', digits: 1, help: 'Frequency where tracking drops 3 dB; higher rejects propwash better', axis: [0, 40] },
  { key: 'sensitivityPeakDb', label: 'Sensitivity', unit: 'dB', digits: 1, help: 'Peak disturbance amplification |1 − T|; 4 dB caution, 6 dB close to oscillating', axis: [0, 8] },
  { key: 'confidence', label: 'Confidence', unit: '', digits: 2, help: 'Coherence in the control band: how much of gyro the setpoint explains (1 = all)', axis: [0, 1] },
];

export function stepMetricOption(key: keyof StepMetrics): StepMetricOption {
  return STEP_METRICS.find((m) => m.key === key) ?? STEP_METRICS[0]!;
}

export function formatStepMetric(option: StepMetricOption, value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';

  return option.unit ? `${value.toFixed(option.digits)} ${option.unit}` : value.toFixed(option.digits);
}
