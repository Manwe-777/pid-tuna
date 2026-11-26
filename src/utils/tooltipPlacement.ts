import { TOOLTIP_EDGE_PX, TOOLTIP_GAP_PX } from '../constants';
import type { TooltipPlacement, ViewportRect } from '../types';

/**
 * Places a tooltip centred above its element, or below when there's no room
 * above, and slides it sideways to stay inside the window. The arrow keeps
 * pointing at the element's centre.
 */
export function tooltipPlacement(
  anchor: ViewportRect,
  tip: { width: number; height: number },
  viewport: { width: number; height: number },
): TooltipPlacement {
  const roomAbove = anchor.top - TOOLTIP_GAP_PX - TOOLTIP_EDGE_PX;
  const roomBelow = viewport.height - (anchor.top + anchor.height) - TOOLTIP_GAP_PX - TOOLTIP_EDGE_PX;
  const side = tip.height <= roomAbove || roomAbove >= roomBelow ? 'above' : 'below';
  const top = side === 'above' ? anchor.top - TOOLTIP_GAP_PX - tip.height : anchor.top + anchor.height + TOOLTIP_GAP_PX;

  const centre = anchor.left + anchor.width / 2;
  const maxLeft = viewport.width - TOOLTIP_EDGE_PX - tip.width;
  const left = Math.max(TOOLTIP_EDGE_PX, Math.min(maxLeft, centre - tip.width / 2));
  const arrowX = Math.max(8, Math.min(tip.width - 8, centre - left));

  return { left, top, side, arrowX };
}
