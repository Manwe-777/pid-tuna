import { describe, expect, test } from 'vitest';

import { flightLabel } from './flightLabel';

describe('flightLabel', () => {
  test('a file with one flight keeps its name', () => {
    expect(flightLabel('LOG00005.BFL', 0, 1)).toBe('LOG00005.BFL');
  });

  test('flights in a multi-flight file are numbered from 1', () => {
    expect(flightLabel('LOG00005.BFL', 0, 3)).toBe('LOG00005.BFL #1');
    expect(flightLabel('LOG00005.BFL', 2, 3)).toBe('LOG00005.BFL #3');
  });
});
