import type { StepResultSpread } from '../types';
import { timeMetrics } from './stepTimeMetrics';

export const SPREAD_KEYS = [
  'riseTimeMs',
  'overshootPct',
  'peakTimeMs',
  'settlingTimeMs',
  'latencyHalfMs',
  'peakResponse',
] as const;

export function metricSpread(time: Float32Array, segments: Float32Array[], steadyFrom: number): StepResultSpread {
  if (segments.length < 2) return {};

  const per = segments.map((seg) => timeMetrics(time, seg, steadyFrom));
  const out: StepResultSpread = {};

  for (const key of SPREAD_KEYS) {
    const values = per.map((m) => m[key]).filter((v): v is number => v != null && Number.isFinite(v));
    if (values.length < 2) continue;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    out[key] = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);
  }

  return out;
}
