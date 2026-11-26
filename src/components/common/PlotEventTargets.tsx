import { PLOT_EVENT_INSET_PX, PLOT_EVENT_RADIUS_PX } from '../../constants';
import { visibleEvents } from '../../plot/visibleEvents';
import type { PlotArea, PlotEvent } from '../../types';

/**
 * Invisible hover targets over the event icons a plot draws, so each one
 * shows its tooltip. `area` is in CSS px relative to the positioned parent.
 */
export function PlotEventTargets({
  events,
  area,
  slack = 0,
}: {
  events: readonly PlotEvent[];
  area: PlotArea;
  slack?: number;
}) {
  const size = PLOT_EVENT_RADIUS_PX * 2;

  return visibleEvents(events, area, slack).map(({ event, x }) => (
    <span
      key={`${event.kind}-${event.time}-${event.label}`}
      className="plot-event-target"
      role="img"
      aria-label={event.label}
      data-tip={event.label}
      style={{ left: x - PLOT_EVENT_RADIUS_PX, top: area.top + PLOT_EVENT_INSET_PX, width: size, height: size }}
    />
  ));
}
