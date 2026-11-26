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

describe('ZoomGroup selection', () => {
  test('double-clicking a selection zooms every plot to it and clears it', () => {
    const g = new ZoomGroup();
    const a = plot(g);
    const b = plot(g);
    g.join(a);
    g.join(b);
    g.select({ min: 12, max: 18 });
    expect(g.zoomToSelection(a)).toBe(true);
    expect(b.scales.x).toEqual({ min: 12, max: 18 });
    expect(g.selection).toBeNull();
  });

  test('without a selection, zoomToSelection leaves the plots alone', () => {
    const g = new ZoomGroup();
    const a = plot(g);
    g.join(a);
    expect(g.zoomToSelection(a)).toBe(false);
    expect(a.scales.x).toEqual({ min: 0, max: 100 });
  });

  test('listeners hear each change once, and an empty span clears the selection', () => {
    const g = new ZoomGroup();
    let calls = 0;
    g.subscribe(() => calls++);
    g.select({ min: 1, max: 2 });
    g.select({ min: 1, max: 2 });
    g.select({ min: 3, max: 3 });
    expect(calls).toBe(2);
    expect(g.selection).toBeNull();
  });
});

describe('ZoomGroup zoom state', () => {
  test('listeners hear when the group zooms in and when it zooms back out', () => {
    const g = new ZoomGroup();
    const a = plot(g);
    g.join(a);
    let calls = 0;
    g.subscribe(() => calls++);
    a.zoom(10, 20);
    expect(g.range).toEqual({ min: 10, max: 20 });
    a.zoom(0, 100);
    expect(g.range).toBeNull();
    expect(calls).toBe(2);
  });
});
