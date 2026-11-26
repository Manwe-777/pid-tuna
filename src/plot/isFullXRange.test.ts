import { describe, expect, test } from 'vitest';

import { isFullXRange } from './isFullXRange';

const data = { first: 0, last: 500 };

describe('isFullXRange', () => {
  test('the whole data range is not zoomed; a part of it is', () => {
    expect(isFullXRange({ min: 0, max: 500 }, data, {})).toBe(true);
    expect(isFullXRange({ min: 10, max: 500 }, data, {})).toBe(false);
  });

  test('a plot pinned to 0–100 counts as zoomed out at 0–100, not at the full data', () => {
    expect(isFullXRange({ min: 0, max: 100 }, data, { xMin: 0, xMax: 100 })).toBe(true);
    expect(isFullXRange({ min: 20, max: 60 }, data, { xMin: 0, xMax: 100 })).toBe(false);
  });

  test('float rounding at the ends does not count as a zoom', () => {
    expect(isFullXRange({ min: 1e-9, max: 499.9999999 }, data, {})).toBe(true);
  });

  test('a scale that is not set yet counts as zoomed out', () => {
    expect(isFullXRange({}, data, {})).toBe(true);
  });
});
