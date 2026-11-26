import { describe, expect, test } from 'vitest';

import { flightRange } from './flightRange';

const FS = 10;
const series = (parts: [number, number][]) =>
  Float32Array.from(parts.flatMap(([pct, seconds]) => Array<number>(seconds * FS).fill(pct)));

describe('takeoff to landing', () => {
  test('ground time before takeoff and after landing is left out', () => {
    const r = flightRange(
      series([
        [0, 3],
        [40, 10],
        [0, 2],
      ]),
      FS,
    );
    expect(r).toEqual({ start: 30, end: 129 });
  });

  test('a throttle cut for a flip stays inside the flight', () => {
    const r = flightRange(
      series([
        [0, 2],
        [40, 5],
        [0, 1],
        [40, 5],
        [0, 2],
      ]),
      FS,
    )!;
    expect(r.start).toBe(20);
    expect(r.end).toBe(129);
  });

  test('a brief throttle blip on the ground is not a takeoff', () => {
    const r = flightRange(
      series([
        [0, 2],
        [50, 0.2],
        [0, 2],
        [40, 5],
        [0, 1],
      ]),
      FS,
    )!;
    expect(r.start).toBe(42);
  });

  test('a log that never takes off has no flight', () => {
    expect(flightRange(series([[5, 10]]), FS)).toBeNull();
  });
});
