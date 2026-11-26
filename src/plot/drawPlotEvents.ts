import type { PlotArea, PlotEvent } from '../types';
import { drawEventMarker } from './drawEventMarker';
import { visibleEvents } from './visibleEvents';

/** Draws every event inside the area's x range (see `visibleEvents` for `slack`). Area and `s` are in canvas units. */
export function drawPlotEvents(
  ctx: CanvasRenderingContext2D,
  events: readonly PlotEvent[] | undefined,
  area: PlotArea,
  s: number,
  slack = 0,
) {
  if (!events?.length) return;

  for (const { event, x } of visibleEvents(events, area, slack)) {
    drawEventMarker(ctx, x, area.top, area.top + area.height, event.kind, s);
  }
}
