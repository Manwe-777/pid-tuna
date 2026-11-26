import { describe, expect, test } from 'vitest';

import type { TuneView } from '../tuneView';
import { computeFilterDelays, DELAY_REFERENCE_HZ } from './filterDelays';

const BASE: TuneView = {
  hasPid: false,
  pidByAxis: [],
  hasRates: false,
  rcRates: [],
  rcExpo: [],
  superRates: [],
  rpmWeights: [],
  gyroRateHz: 8000,
  pidRateHz: 4000,
};

/** Continuous-time phase delay of n cascaded first-order stages at cutoff fc·k, at f. */
function analogPtnDelayMs(fc: number, order: number, f = DELAY_REFERENCE_HZ): number {
  const k = order === 1 ? 1 : 1 / Math.sqrt(2 ** (1 / order) - 1);

  return ((order * Math.atan(f / (fc * k))) / (2 * Math.PI * f)) * 1000;
}

const within = (actual: number, expected: number, frac: number) => expect(Math.abs(actual / expected - 1)).toBeLessThan(frac);

describe('filter delay breakdown', () => {
  test.each([
    [0, 1],
    [2, 2],
    [3, 3],
  ])('a type-%i lowpass at 100 Hz matches the analog delay of its Betaflight design within 5%%', (type, order) => {
    const d = computeFilterDelays({ ...BASE, gyroLpf1Hz: 100, gyroLpf1Type: type });
    within(d.gyroDelayMs, analogPtnDelayMs(100, order), 0.05);
  });

  test('a PT2 delays less than two plain PT1s at the same cutoff, because Betaflight raises its stages', () => {
    const pt2 = computeFilterDelays({ ...BASE, gyroLpf1Hz: 100, gyroLpf1Type: 2 }).gyroDelayMs;
    expect(pt2).toBeLessThan(analogPtnDelayMs(100, 1) * 2 * 0.75);
  });

  test('D-term filters add to the D path only, not to the delay every term sees', () => {
    const gyroOnly = computeFilterDelays({ ...BASE, gyroLpf2Hz: 500 });
    const withD = computeFilterDelays({ ...BASE, gyroLpf2Hz: 500, dtermLpf1Hz: 100, dtermLpf1Type: 0 });
    expect(withD.gyroDelayMs).toBeCloseTo(gyroOnly.gyroDelayMs, 6);
    expect(withD.dPathDelayMs).toBeGreaterThan(gyroOnly.dPathDelayMs + 1);
  });

  test('a dynamic lowpass is rated at its minimum cutoff', () => {
    const d = computeFilterDelays({ ...BASE, gyroLpf1Hz: 0, gyroDynRange: { min: 200, max: 500 } });
    within(d.gyroDelayMs, analogPtnDelayMs(200, 1), 0.05);
    expect(d.entries[0]!.dynamic).toBe(true);
  });

  test('a static notch above the control band still adds some delay in it', () => {
    const d = computeFilterDelays({ ...BASE, gyroNotch1Hz: 150, gyroNotch1Cutoff: 100 });
    expect(d.gyroDelayMs).toBeGreaterThan(0.05);
  });

  test('RPM notches add more delay when the motors spin slower', () => {
    const rpm = { ...BASE, rpmHarmonics: 3, rpmMinHz: 100, rpmQ: 500 };
    const slow = computeFilterDelays(rpm, { motorHz: 150 }).gyroDelayMs;
    const fast = computeFilterDelays(rpm, { motorHz: 300 }).gyroDelayMs;
    expect(slow).toBeGreaterThan(fast);
  });

  test('an RPM harmonic with weight 0 adds no delay', () => {
    const rpm = { ...BASE, rpmHarmonics: 1, rpmMinHz: 100, rpmQ: 500 };
    expect(computeFilterDelays({ ...rpm, rpmWeights: [0] }, { motorHz: 200 }).gyroDelayMs).toBe(0);
  });

  test('no filters configured means no delay', () => {
    const d = computeFilterDelays(BASE);
    expect(d.entries).toHaveLength(0);
    expect(d.gyroDelayMs).toBe(0);
  });
});
