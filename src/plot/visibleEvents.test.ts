import { describe, expect, test } from 'vitest';

import type { PlotEvent } from '../types';
import { visibleEvents } from './visibleEvents';

const arm: PlotEvent = { time: 0, kind: 'arm', label: 'Armed' };
const disarm: PlotEvent = { time: 120, kind: 'disarm', label: 'Disarmed' };
const area = { left: 50, top: 10, width: 400, height: 200, xMin: 0, xMax: 120 };

describe('visibleEvents', () => {
  test('events at the ends of the range sit on the area edges', () => {
    expect(visibleEvents([arm, disarm], area).map((v) => v.x)).toEqual([50, 450]);
  });

  test('events outside a zoomed range are left out', () => {
    const zoomed = { ...area, xMin: 10, xMax: 60 };
    expect(visibleEvents([arm, { ...arm, time: 35 }, disarm], zoomed)).toEqual([
      { event: { ...arm, time: 35 }, x: 250 },
    ]);
  });

  test('with slack, events just past an edge sit on that edge and farther ones stay hidden', () => {
    const xs = visibleEvents(
      [
        { ...arm, time: -0.1 },
        { ...disarm, time: 120.2 },
        { ...disarm, time: 125 },
      ],
      area,
      0.3,
    );
    expect(xs.map((v) => v.x)).toEqual([50, 450]);
  });

  test('an empty or collapsed range shows nothing', () => {
    expect(visibleEvents([arm], { ...area, xMax: 0 })).toEqual([]);
    expect(visibleEvents([arm], { ...area, width: 0 })).toEqual([]);
  });
});
