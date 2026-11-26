import { describe, expect, test } from 'vitest';

import { moveSpanEdge } from './moveSpanEdge';

const bounds = { min: 0, max: 100 };

describe('moveSpanEdge', () => {
  test('moving one edge keeps the other where it was', () => {
    expect(moveSpanEdge({ min: 10, max: 20 }, 'min', 5, bounds)).toEqual({ min: 5, max: 20 });
    expect(moveSpanEdge({ min: 10, max: 20 }, 'max', 30, bounds)).toEqual({ min: 10, max: 30 });
  });

  test('an edge dragged past the other stops just short of it', () => {
    const s = moveSpanEdge({ min: 10, max: 20 }, 'min', 25, bounds);
    expect(s.max).toBe(20);
    expect(s.min).toBeLessThan(20);
    expect(s.min).toBeGreaterThan(19.5);
  });

  test('an edge cannot leave the plotted range', () => {
    expect(moveSpanEdge({ min: 10, max: 20 }, 'min', -5, bounds)).toEqual({ min: 0, max: 20 });
    expect(moveSpanEdge({ min: 10, max: 20 }, 'max', 500, bounds)).toEqual({ min: 10, max: 100 });
  });
});
