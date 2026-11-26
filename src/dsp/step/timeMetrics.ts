import type { TimeMetrics } from '../../types';
import { firstCrossing } from '../../utils/firstCrossing';
import { meanOf } from '../../utils/meanOf';
import { settlingTime } from './settlingTime';

export function timeMetrics(time: Float32Array, step: Float32Array, steadyFrom: number): TimeMetrics {
  const none: TimeMetrics = {
    riseTimeMs: null,
    overshootPct: null,
    peakTimeMs: null,
    settlingTimeMs: null,
    latencyHalfMs: null,
    peakResponse: null,
    steadyState: null,
  };
  if (step.length < 2) return none;

  const steadyState = meanOf(step, steadyFrom, step.length);
  if (!(steadyState > 0.05)) return { ...none, steadyState: Number.isFinite(steadyState) ? steadyState : null };

  let peak = -Infinity;
  let peakAt = 0;

  for (let i = 0; i < step.length; i++) {
    if (step[i]! > peak) {
      peak = step[i]!;
      peakAt = i;
    }
  }

  const t10 = firstCrossing(time, step, 0.1 * steadyState);
  const t90 = firstCrossing(time, step, 0.9 * steadyState);

  return {
    riseTimeMs: t10 != null && t90 != null && t90 >= t10 ? t90 - t10 : null,
    overshootPct: peak > steadyState ? (peak / steadyState - 1) * 100 : 0,
    peakTimeMs: time[peakAt]!,
    settlingTimeMs: settlingTime(time, step, steadyState),
    latencyHalfMs: firstCrossing(time, step, 0.5 * steadyState),
    peakResponse: peak,
    steadyState,
  };
}
