import { describe, expect, test } from 'vitest';

import { computeStepResponse } from './stepResponse';
import type { ClosedLoopPlant } from './testing/simulateClosedLoop';
import { syntheticFlight } from './testing/syntheticFlight';
import { trueStepMetrics } from './testing/trueStepMetrics';

const ACRO: ClosedLoopPlant = { naturalHz: 14, damping: 0.55, delaySamples: 8 };
const UNDERDAMPED: ClosedLoopPlant = { naturalHz: 22, damping: 0.35, delaySamples: 6 };
const CRUISE: ClosedLoopPlant = { naturalHz: 10, damping: 0.7, delaySamples: 10 };

function estimate(plant: ClosedLoopPlant, extra: Partial<Parameters<typeof syntheticFlight>[0]> = {}) {
  const f = syntheticFlight({ plant, ...extra });

  return computeStepResponse(f.setpoint, f.gyro, 1e6 / f.sampleRateHz);
}

describe('step response against a simulated drone with a known response', () => {
  test.each([
    ['acro', ACRO],
    ['underdamped', UNDERDAMPED],
  ])('rise time on an %s tune is within 1.5 ms of the truth', (_name, plant) => {
    expect(Math.abs(estimate(plant).metrics.riseTimeMs! - trueStepMetrics(plant, 2000).riseTimeMs)).toBeLessThan(1.5);
  });

  test.each([
    ['acro', ACRO],
    ['underdamped', UNDERDAMPED],
  ])('time to reach 50%% on an %s tune is within 1 ms of the truth', (_name, plant) => {
    expect(Math.abs(estimate(plant).metrics.latencyHalfMs! - trueStepMetrics(plant, 2000).latencyHalfMs)).toBeLessThan(1);
  });

  test.fails('overshoot on an acro tune is within 1.5 points of the truth', () => {
    for (const seed of [7, 11]) {
      const err = estimate(ACRO, { seed }).metrics.overshootPct! - trueStepMetrics(ACRO, 2000).overshootPct;
      expect(Math.abs(err)).toBeLessThan(1.5);
    }
  });

  test.fails('overshoot on a cruise flight with long stick holds is within 2 points of the truth', () => {
    const err = estimate(CRUISE, { holdMs: [300, 2000] }).metrics.overshootPct! - trueStepMetrics(CRUISE, 2000).overshootPct;
    expect(Math.abs(err)).toBeLessThan(2);
  });

  test.fails('the same tune flown twice gives overshoot readings less than 1 point apart', () => {
    const a = estimate(ACRO, { seed: 7 }).metrics.overshootPct!;
    const b = estimate(ACRO, { seed: 11 }).metrics.overshootPct!;
    expect(Math.abs(a - b)).toBeLessThan(1);
  });

  test('more gyro noise does not change the rise time by more than 1 ms', () => {
    const quiet = estimate(ACRO, { noise: 0, motorTone: 0 }).metrics.riseTimeMs!;
    const loud = estimate(ACRO, { noise: 60, motorTone: 40 }).metrics.riseTimeMs!;
    expect(Math.abs(quiet - loud)).toBeLessThan(1);
  });
});

describe('step response window gating', () => {
  test('a flight with no stick input produces no step response', () => {
    const silent = new Float32Array(20000);
    const r = computeStepResponse(silent, silent, 500);
    expect(r.segments).toHaveLength(0);
    expect(r.metrics.riseTimeMs).toBeNull();
    expect(r.diagnostics.windowsLowExcitation).toBe(r.diagnostics.windowsTotal);
  });

  test('a log shorter than one analysis window produces no step response', () => {
    const f = syntheticFlight({ plant: ACRO, seconds: 0.5 });
    expect(computeStepResponse(f.setpoint, f.gyro, 500).segments).toHaveLength(0);
  });
});
