import { describe, expect, test } from 'vitest';

import { sampleClockTime } from './sampleClockTime';

// 2000 samples whose timestamps run 1% slow against a nominal 1000 Hz clock.
const time = Float32Array.from({ length: 2000 }, (_, i) => 10 + i / 990);

describe('sampleClockTime', () => {
  test('counts samples from the start of the slice, not log time', () => {
    expect(sampleClockTime(time, 1000, 10)).toBe(0);
    expect(sampleClockTime(time, 1000, 10 + 990 / 990)).toBeCloseTo(0.99, 3);
  });

  test('times past either end land on the first or last sample', () => {
    expect(sampleClockTime(time, 1000, 0)).toBe(0);
    expect(sampleClockTime(time, 1000, 999)).toBe(1.999);
  });

  test('an empty slice puts everything at zero', () => {
    expect(sampleClockTime(new Float32Array(0), 1000, 5)).toBe(0);
  });
});
