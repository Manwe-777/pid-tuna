import { describe, expect, test } from 'vitest';

import { TOOLTIP_EDGE_PX, TOOLTIP_GAP_PX } from '../constants';
import { tooltipPlacement } from './tooltipPlacement';

const viewport = { width: 1000, height: 800 };
const tip = { width: 200, height: 40 };

describe('tooltipPlacement', () => {
  test('sits centred above the element, clear of it', () => {
    const anchor = { left: 400, top: 300, width: 100, height: 20 };
    const p = tooltipPlacement(anchor, tip, viewport);

    expect(p.side).toBe('above');
    expect(p.top + tip.height).toBeLessThanOrEqual(anchor.top - TOOLTIP_GAP_PX);
    expect(p.left + tip.width / 2).toBe(anchor.left + anchor.width / 2);
  });

  test('goes below an element at the top of the window', () => {
    const anchor = { left: 400, top: 10, width: 100, height: 20 };
    const p = tooltipPlacement(anchor, tip, viewport);

    expect(p.side).toBe('below');
    expect(p.top).toBeGreaterThanOrEqual(anchor.top + anchor.height + TOOLTIP_GAP_PX);
  });

  test('stays inside the window next to either edge', () => {
    const atLeft = tooltipPlacement({ left: 0, top: 300, width: 20, height: 20 }, tip, viewport);
    const atRight = tooltipPlacement({ left: 990, top: 300, width: 10, height: 20 }, tip, viewport);

    expect(atLeft.left).toBe(TOOLTIP_EDGE_PX);
    expect(atRight.left + tip.width).toBe(viewport.width - TOOLTIP_EDGE_PX);
  });

  test('the arrow still points at the element after sliding sideways', () => {
    const anchor = { left: 0, top: 300, width: 40, height: 20 };
    const p = tooltipPlacement(anchor, tip, viewport);

    expect(p.left + p.arrowX).toBe(anchor.left + anchor.width / 2);
  });

  test('the arrow stays on the tooltip when the element is past its end', () => {
    const p = tooltipPlacement({ left: 996, top: 300, width: 4, height: 20 }, tip, viewport);

    expect(p.arrowX).toBeLessThanOrEqual(tip.width);
    expect(p.arrowX).toBeGreaterThanOrEqual(0);
  });

  test('a tooltip too tall for either side goes where there is more room', () => {
    const tall = { width: 200, height: 500 };
    const nearBottom = tooltipPlacement({ left: 400, top: 600, width: 100, height: 20 }, tall, viewport);
    const nearTop = tooltipPlacement({ left: 400, top: 150, width: 100, height: 20 }, tall, viewport);

    expect(nearBottom.side).toBe('above');
    expect(nearTop.side).toBe('below');
  });
});
