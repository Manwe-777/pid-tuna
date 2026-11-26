import { describe, expect, test } from 'vitest';

import { SLIDER_STEPS } from '../constants';
import { sliderIsLog } from './sliderIsLog';
import { sliderPosition } from './sliderPosition';
import { sliderValue } from './sliderValue';

describe('filter sliders', () => {
  test('wide positive ranges are logarithmic, narrow or zero-based ones linear', () => {
    expect(sliderIsLog(1, 800)).toBe(true);
    expect(sliderIsLog(10, 2000)).toBe(true);
    expect(sliderIsLog(0, 500)).toBe(false);
    expect(sliderIsLog(10, 100)).toBe(false);
  });

  test('the ends of the slider are the ends of the range', () => {
    expect(sliderValue(0, 1, 800, 5)).toBe(1);
    expect(sliderValue(SLIDER_STEPS, 1, 800, 5)).toBe(800);
    expect(sliderPosition(1, 1, 800)).toBe(0);
    expect(sliderPosition(800, 1, 800)).toBe(SLIDER_STEPS);
  });

  test('on a log slider the low frequencies get as much travel as the high ones', () => {
    const mid = sliderValue(SLIDER_STEPS / 2, 1, 800, 1);
    expect(mid).toBeGreaterThan(20);
    expect(mid).toBeLessThan(40);
  });

  test('a value placed on the slider reads back as itself, to the step', () => {
    for (const v of [5, 150, 333, 795]) {
      expect(Math.abs(sliderValue(sliderPosition(v, 1, 800), 1, 800, 1) - v)).toBeLessThanOrEqual(v * 0.01 + 1);
    }

    expect(sliderValue(sliderPosition(50, 0, 500), 0, 500, 5)).toBe(50);
  });

  test('values snap to the step and never leave the range', () => {
    expect(sliderValue(437, 0, 500, 5) % 5).toBe(0);
    expect(sliderValue(-20, 0, 500, 5)).toBe(0);
    expect(sliderValue(SLIDER_STEPS * 2, 0, 500, 5)).toBe(500);
    expect(sliderPosition(9999, 10, 2000)).toBe(SLIDER_STEPS);
  });
});
