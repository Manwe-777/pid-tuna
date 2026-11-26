import type { PlotArea, PlotEvent } from '../types';

/**
 * The events inside the area's x range, each with its x position in the area's
 * units. Events up to `slack` outside the range sit on the nearer edge, for
 * plots whose first and last columns stand for a stretch of time.
 */
export function visibleEvents(
  events: readonly PlotEvent[],
  area: PlotArea,
  slack = 0,
): { event: PlotEvent; x: number }[] {
  const span = area.xMax - area.xMin;
  if (!(span > 0) || area.width <= 0) return [];

  return events
    .filter((e) => e.time >= area.xMin - slack && e.time <= area.xMax + slack)
    .map((event) => {
      const t = Math.min(area.xMax, Math.max(area.xMin, event.time));

      return { event, x: area.left + ((t - area.xMin) / span) * area.width };
    });
}
