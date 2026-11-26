import { describe, expect, test } from 'vitest';

import { fitYRange } from './fitYRange';

describe('fitYRange', () => {
  test('new data gets a range that holds all of it with some room', () => {
    const r = fitYRange({ lo: 0, hi: 10 }, {})!;
    expect(r.min).toBeLessThan(0);
    expect(r.max).toBeGreaterThan(10);
    expect(r.max - r.min).toBeLessThan(12);
  });

  test('pinned bounds win on their side', () => {
    expect(fitYRange({ lo: -100, hi: 3 }, { yMin: -60, yMax: 6 })).toEqual({ min: -60, max: 6 });
    expect(fitYRange({ lo: 0, hi: 10 }, { yMin: -5 })?.min).toBe(-5);
  });

  test('a flat line still gets a usable range', () => {
    const r = fitYRange({ lo: 4, hi: 4 }, {})!;
    expect(r.min).toBeLessThan(4);
    expect(r.max).toBeGreaterThan(4);
  });

  test('no data and nothing pinned leaves the scale alone', () => {
    expect(fitYRange(null, {})).toBeNull();
  });
});
