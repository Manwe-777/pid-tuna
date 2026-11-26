import { describe, expect, test } from 'vitest';

import { ZoomGroup, type ZoomMember } from './ZoomGroup';

/** A plot whose X scale feeds back into the group the way uPlot's setScale hook does. */
function plot(group: ZoomGroup, full = { min: 0, max: 100 }): ZoomMember & { zoom: (a: number, b: number) => void } {
  const p = {
    scales: { x: { ...full } },
    setScale(_: 'x', l: { min: number; max: number }) {
      p.scales.x = { ...l };
      group.publish(p, l.min === full.min && l.max === full.max);
    },
    zoom: (min: number, max: number) => p.setScale('x', { min, max }),
  };

  return p;
}

describe('ZoomGroup', () => {
  test('zooming one plot zooms the others to the same range', () => {
    const g = new ZoomGroup();
    const a = plot(g);
    const b = plot(g);
    const c = plot(g);
    [a, b, c].forEach((p) => g.join(p));
    b.zoom(10, 20);
    expect([a, b, c].map((p) => p.scales.x)).toEqual(Array(3).fill({ min: 10, max: 20 }));
  });

  test('a plot that joins after a zoom starts at the zoomed range', () => {
    const g = new ZoomGroup();
    const a = plot(g);
    g.join(a);
    a.zoom(30, 40);
    const late = plot(g);
    g.join(late);
    expect(late.scales.x).toEqual({ min: 30, max: 40 });
  });

  test('zooming back out to the full range is not carried to plots that join later', () => {
    const g = new ZoomGroup();
    const a = plot(g);
    g.join(a);
    a.zoom(30, 40);
    a.zoom(0, 100);
    expect(g.range).toBeNull();
  });

  test('a plot that left is no longer zoomed', () => {
    const g = new ZoomGroup();
    const a = plot(g);
    const b = plot(g);
    g.join(a);
    const leave = g.join(b);
    leave();
    a.zoom(5, 6);
    expect(b.scales.x).toEqual({ min: 0, max: 100 });
  });
});
