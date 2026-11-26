import { type ClosedLoopPlant, simulateClosedLoop } from './simulateClosedLoop';

/** Ground-truth step metrics of a simulated plant, normalised to its own steady state. */
export function trueStepMetrics(plant: ClosedLoopPlant, sampleRateHz: number) {
  const y = simulateClosedLoop(new Float32Array(sampleRateHz).fill(1), sampleRateHz, { ...plant, gain: 1 });
  const msPerSample = 1000 / sampleRateHz;

  const cross = (target: number): number => {
    for (let i = 1; i < y.length; i++) {
      if (y[i - 1]! < target && y[i]! >= target) return (i - 1 + (target - y[i - 1]!) / (y[i]! - y[i - 1]!)) * msPerSample;
    }

    return Number.NaN;
  };

  let peak = 0;
  for (const v of y) peak = Math.max(peak, v);

  return { riseTimeMs: cross(0.9) - cross(0.1), latencyHalfMs: cross(0.5), overshootPct: (peak - 1) * 100 };
}
