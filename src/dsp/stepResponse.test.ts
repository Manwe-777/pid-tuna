import { describe, expect, test } from 'vitest';
import { STEP_DEFAULTS } from '../constants';
import { combineStepResponses } from './combineStepResponses';
import { computeStepResponse } from './stepResponse';
import type { ClosedLoopPlant } from './testing/simulateClosedLoop';
import { stickSetpoint } from './testing/stickSetpoint';
import { syntheticFlight, type SyntheticFlightOptions } from './testing/syntheticFlight';
import { trueFrequencyMetrics } from './testing/trueFrequencyMetrics';
import { trueStepMetrics } from './testing/trueStepMetrics';

const ACRO: ClosedLoopPlant = { naturalHz: 14, damping: 0.55, delaySamples: 8 };
const UNDERDAMPED: ClosedLoopPlant = { naturalHz: 22, damping: 0.35, delaySamples: 6 };
const CRUISE: ClosedLoopPlant = { naturalHz: 10, damping: 0.7, delaySamples: 10 };

/** Stick input with the slow, low-frequency character of real flights. */
const SMOOTH_PILOT: Partial<SyntheticFlightOptions> = { smoothingHz: 4, holdMs: [150, 800], seconds: 120 };
const FREESTYLE_PILOT: Partial<SyntheticFlightOptions> = { smoothingHz: 8, holdMs: [100, 600], seconds: 120 };

function estimate(plant: ClosedLoopPlant, extra: Partial<SyntheticFlightOptions> = {}) {
  const f = syntheticFlight({ plant, ...extra });

  return computeStepResponse(f.setpoint, f.gyro, 1e6 / f.sampleRateHz);
}

function errors(plant: ClosedLoopPlant, extra: Partial<SyntheticFlightOptions> = {}) {
  const m = estimate(plant, extra).metrics;
  const t = trueStepMetrics(plant, 2000);

  return {
    rise: Math.abs(m.riseTimeMs! - t.riseTimeMs),
    half: Math.abs(m.latencyHalfMs! - t.latencyHalfMs),
    overshoot: Math.abs(m.overshootPct! - t.overshootPct),
  };
}

describe('step response against a simulated drone with a known response', () => {
  test.each([
    ['acro', ACRO],
    ['underdamped', UNDERDAMPED],
  ])('rise time on an %s tune is within 1.5 ms of the truth', (_name, plant) => {
    expect(errors(plant).rise).toBeLessThan(1.5);
  });

  test.each([
    ['acro', ACRO],
    ['underdamped', UNDERDAMPED],
  ])('time to reach 50%% on an %s tune is within 1 ms of the truth', (_name, plant) => {
    expect(errors(plant).half).toBeLessThan(1);
  });

  test('overshoot on an acro tune is within 1.5 points of the truth', () => {
    for (const seed of [7, 11]) expect(errors(ACRO, { seed }).overshoot).toBeLessThan(1.5);
  });

  test.fails('overshoot on a cruise flight with long stick holds is within 2 points of the truth', () => {
    expect(errors(CRUISE, { holdMs: [300, 2000] }).overshoot).toBeLessThan(2);
  });

  test('the same tune flown twice gives overshoot readings less than 1 point apart', () => {
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

describe('step response with realistic, slow stick input', () => {
  test.each([
    ['smooth', SMOOTH_PILOT],
    ['freestyle', FREESTYLE_PILOT],
  ])('a %s pilot on an acro tune reads rise within 2 ms and overshoot within 2 points', (_name, pilot) => {
    const e = errors(ACRO, pilot);
    expect(e.rise).toBeLessThan(2);
    expect(e.overshoot).toBeLessThan(2);
  });

  test.each([
    ['smooth', SMOOTH_PILOT],
    ['freestyle', FREESTYLE_PILOT],
  ])('a %s pilot on a fast, underdamped tune still shows the overshoot within 4 points', (_name, pilot) => {
    expect(errors(UNDERDAMPED, pilot).overshoot).toBeLessThan(4);
  });

  test('slow stick input does not make a tune look slower than it is', () => {
    const m = estimate(ACRO, SMOOTH_PILOT).metrics;
    expect(m.riseTimeMs!).toBeLessThan(trueStepMetrics(ACRO, 2000).riseTimeMs + 2);
  });
});

describe('steady-state tracking', () => {
  test('a drone that only reaches 90% of setpoint reads a steady state of 0.9', () => {
    expect(estimate({ ...ACRO, gain: 0.9 }).metrics.steadyState!).toBeCloseTo(0.9, 1);
    expect(Math.abs(estimate({ ...ACRO, gain: 0.9 }).metrics.steadyState! - 0.9)).toBeLessThan(0.02);
  });

  test('tracking error does not change the shape metrics', () => {
    const full = estimate(ACRO).metrics;
    const short = estimate({ ...ACRO, gain: 0.9 }).metrics;
    expect(Math.abs(full.riseTimeMs! - short.riseTimeMs!)).toBeLessThan(0.5);
    expect(Math.abs(full.overshootPct! - short.overshootPct!)).toBeLessThan(0.5);
  });

  test('peak response is in setpoint units, so a 90% tracker with 12% overshoot peaks near 1.0', () => {
    const m = estimate({ ...ACRO, gain: 0.9 }).metrics;
    expect(m.peakResponse!).toBeCloseTo(m.steadyState! * (1 + m.overshootPct! / 100), 3);
  });
});

describe('step response window screening', () => {
  test('a flight with no stick input produces no step response', () => {
    const silent = new Float32Array(20000);
    const r = computeStepResponse(silent, silent, 500);
    expect(r.segments).toHaveLength(0);
    expect(r.metrics.riseTimeMs).toBeNull();
    expect(r.diagnostics.windowsLowExcitation).toBe(r.diagnostics.windowsTotal);
  });

  test('a log shorter than one analysis window produces no step response', () => {
    const f = syntheticFlight({ plant: ACRO, seconds: 1.5 });
    expect(computeStepResponse(f.setpoint, f.gyro, 500).segments).toHaveLength(0);
  });

  test('a few seconds of gyro dropout are screened out and barely move the result', () => {
    const f = syntheticFlight({ plant: ACRO });
    const clean = computeStepResponse(f.setpoint, f.gyro, 500).metrics;
    const broken = f.gyro.slice();
    broken.fill(0, 40000, 46000);
    const r = computeStepResponse(f.setpoint, broken, 500);
    expect(r.diagnostics.windowsBadSettle).toBeGreaterThan(0);
    expect(Math.abs(r.metrics.riseTimeMs! - clean.riseTimeMs!)).toBeLessThan(0.5);
    expect(Math.abs(r.metrics.steadyState! - clean.steadyState!)).toBeLessThan(0.02);
  });

  test('the scorecard and the Step response tab share one set of defaults', () => {
    const f = syntheticFlight({ plant: ACRO });
    const implicit = computeStepResponse(f.setpoint, f.gyro, 500);
    const explicit = computeStepResponse(f.setpoint, f.gyro, 500, { ...STEP_DEFAULTS });
    expect(implicit.metrics).toEqual(explicit.metrics);
  });
});

describe('merging step responses from several logs', () => {
  test('two halves of one flight merge to the same answer as the whole flight', () => {
    const f = syntheticFlight({ plant: ACRO, seconds: 120 });
    const half = f.setpoint.length / 2;
    const whole = computeStepResponse(f.setpoint, f.gyro, 500).metrics;
    const merged = combineStepResponses([
      computeStepResponse(f.setpoint.subarray(0, half), f.gyro.subarray(0, half), 500),
      computeStepResponse(f.setpoint.subarray(half), f.gyro.subarray(half), 500),
    ]).metrics;
    expect(Math.abs(merged.riseTimeMs! - whole.riseTimeMs!)).toBeLessThan(0.5);
    expect(Math.abs(merged.overshootPct! - whole.overshootPct!)).toBeLessThan(1);
    expect(Math.abs(merged.steadyState! - whole.steadyState!)).toBeLessThan(0.01);
  });

  test('logs a fraction of a percent apart in logging rate still merge', () => {
    const a = syntheticFlight({ plant: ACRO, seed: 7 });
    const b = syntheticFlight({ plant: ACRO, seed: 11, sampleRateHz: 2008 });
    const ra = computeStepResponse(a.setpoint, a.gyro, 500);
    const rb = computeStepResponse(b.setpoint, b.gyro, 1e6 / 2008);
    const merged = combineStepResponses([ra, rb]);
    expect(merged.diagnostics.windowsAccepted).toBe(ra.diagnostics.windowsAccepted + rb.diagnostics.windowsAccepted);
    expect(merged.segments.every((s) => s.length === ra.time.length)).toBe(true);
  });

  test('a log at a different logging rate is left out of the merge', () => {
    const a = syntheticFlight({ plant: ACRO });
    const b = syntheticFlight({ plant: UNDERDAMPED, sampleRateHz: 1000 });
    const ra = computeStepResponse(a.setpoint, a.gyro, 500);
    const merged = combineStepResponses([ra, computeStepResponse(b.setpoint, b.gyro, 1000)]);
    expect(merged.metrics.riseTimeMs).toBeCloseTo(ra.metrics.riseTimeMs!, 5);
  });
});

describe('frequency-domain metrics', () => {
  test.each([
    ['acro', ACRO],
    ['underdamped', UNDERDAMPED],
  ])('bandwidth on an %s tune is within 10%% of the truth', (_name, plant) => {
    const truth = trueFrequencyMetrics(plant, 2000).bandwidthHz;
    expect(Math.abs(estimate(plant).metrics.bandwidthHz! / truth - 1)).toBeLessThan(0.1);
  });

  test.each([
    ['acro', ACRO],
    ['underdamped', UNDERDAMPED],
  ])('sensitivity peak on an %s tune is within 1 dB of the truth', (_name, plant) => {
    const truth = trueFrequencyMetrics(plant, 2000).sensitivityPeakDb;
    expect(Math.abs(estimate(plant).metrics.sensitivityPeakDb! - truth)).toBeLessThan(1);
  });

  test.each([
    ['acro', ACRO],
    ['underdamped', UNDERDAMPED],
  ])('crossover on an %s tune is within 10%% and phase margin within 5° of the truth', (_name, plant) => {
    const truth = trueFrequencyMetrics(plant, 2000);
    const m = estimate(plant).metrics;
    expect(Math.abs(m.crossoverHz! / truth.crossoverHz - 1)).toBeLessThan(0.1);
    expect(Math.abs(m.phaseMarginDeg! - truth.phaseMarginDeg)).toBeLessThan(5);
  });

  test('a more oscillatory tune shows a smaller phase margin', () => {
    expect(estimate(UNDERDAMPED).metrics.phaseMarginDeg!).toBeLessThan(estimate(ACRO).metrics.phaseMarginDeg! - 10);
  });

  test('a more oscillatory tune shows a higher sensitivity peak', () => {
    expect(estimate(UNDERDAMPED).metrics.sensitivityPeakDb!).toBeGreaterThan(
      estimate(ACRO).metrics.sensitivityPeakDb! + 2,
    );
  });

  test('confidence drops when gyro moves for reasons setpoint does not explain', () => {
    const f = syntheticFlight({ plant: ACRO });
    // Same spectrum and power as the setpoint, so coherence should fall to about 1/(1 + 1) = 0.5.
    const wind = stickSetpoint({
      seconds: 60,
      sampleRateHz: 2000,
      amplitude: 600,
      holdMs: [80, 400],
      smoothingHz: 30,
      seed: 99,
    });
    const gusty = f.gyro.map((v, i) => v + wind[i]!);
    const clean = computeStepResponse(f.setpoint, f.gyro, 500).metrics.confidence!;
    const disturbed = computeStepResponse(f.setpoint, gusty, 500).metrics.confidence!;
    expect(clean).toBeGreaterThan(0.9);
    expect(disturbed).toBeGreaterThan(0.35);
    expect(disturbed).toBeLessThan(0.65);
  });

  test('peak time on an acro tune is within 2 ms of the truth', () => {
    const m = estimate(ACRO).metrics;
    const t = trueStepMetrics(ACRO, 2000);
    expect(Math.abs(m.peakTimeMs! - t.peakTimeMs)).toBeLessThan(2);
  });
});

describe('choosing which parts of the flight count', () => {
  test('masking out the second half of the flight drops its windows', () => {
    const f = syntheticFlight({ plant: ACRO });
    const mask = new Uint8Array(f.setpoint.length).fill(1);
    mask.fill(0, f.setpoint.length / 2);
    const all = computeStepResponse(f.setpoint, f.gyro, 500);
    const half = computeStepResponse(f.setpoint, f.gyro, 500, { mask });
    expect(half.diagnostics.windowsMasked).toBeGreaterThan(0);
    expect(half.diagnostics.windowsAccepted).toBeLessThan(all.diagnostics.windowsAccepted * 0.6);
  });

  test('a ceiling on stick input keeps only the gentle windows', () => {
    const f = syntheticFlight({ plant: ACRO });
    const r = computeStepResponse(f.setpoint, f.gyro, 500, { maxExcitation: 150 });
    expect(r.diagnostics.windowsHighExcitation).toBeGreaterThan(0);
    expect(r.diagnostics.windowsAccepted).toBeGreaterThan(0);
  });

  test('the spread band is zero-width before the step and widest around the rise', () => {
    const r = estimate(ACRO);
    expect(r.spread[0]!).toBeLessThan(0.05);
    expect(Math.max(...r.spread)).toBeGreaterThan(r.spread[0]!);
  });
});

describe('per-window spread of the metrics', () => {
  test('noisier gyro widens the spread of the rise time across windows', () => {
    const quiet = estimate(ACRO, { noise: 5, motorTone: 0 }).metricSpread.riseTimeMs!;
    const loud = estimate(ACRO, { noise: 120, motorTone: 60 }).metricSpread.riseTimeMs!;
    expect(quiet).toBeGreaterThan(0);
    expect(loud).toBeGreaterThan(quiet);
  });

  test('a single window has no spread', () => {
    const f = syntheticFlight({ plant: ACRO, seconds: 2.5 });
    expect(computeStepResponse(f.setpoint, f.gyro, 500, { overlap: 0 }).metricSpread).toEqual({});
  });
});
