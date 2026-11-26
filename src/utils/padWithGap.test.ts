import { describe, expect, test } from 'vitest';

import { padWithGap } from './padWithGap';

describe('padWithGap', () => {
  test('a shorter log stops at its end instead of repeating its last value', () => {
    expect([...padWithGap(Float32Array.of(1, 2), 4)]).toEqual([1, 2, Number.NaN, Number.NaN]);
  });

  test('a longer log is cut to the time axis', () => {
    expect([...padWithGap(Float32Array.of(1, 2, 3), 2)]).toEqual([1, 2]);
  });

  test('a log of the same length is passed through untouched', () => {
    const v = Float32Array.of(1, 2);
    expect(padWithGap(v, 2)).toBe(v);
  });
});
