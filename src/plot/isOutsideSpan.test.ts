import { describe, expect, test } from 'vitest';

import { isOutsideSpan } from './isOutsideSpan';

describe('isOutsideSpan', () => {
  const span = { min: 10, max: 20 };

  test('a click before or after the selection is outside it', () => {
    expect(isOutsideSpan(span, 9.9)).toBe(true);
    expect(isOutsideSpan(span, 20.1)).toBe(true);
  });

  test('a click inside or on an edge keeps the selection', () => {
    expect(isOutsideSpan(span, 15)).toBe(false);
    expect(isOutsideSpan(span, 10)).toBe(false);
    expect(isOutsideSpan(span, 20)).toBe(false);
  });

  test('with no selection there is nothing to clear', () => {
    expect(isOutsideSpan(null, 5)).toBe(false);
  });
});
