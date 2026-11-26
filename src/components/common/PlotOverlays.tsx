import { createPortal } from 'react-dom';

import type { ZoomGroup } from '../../plot/ZoomGroup';
import type { PlotArea, PlotEvent } from '../../types';
import { PlotEventTargets } from './PlotEventTargets';
import { PlotSelection } from './PlotSelection';

/** HTML layered over a uPlot plot area: event hover targets and the time selection. */
export function PlotOverlays({
  layer,
  events,
  group,
}: {
  layer: { area: PlotArea; over: HTMLElement } | null;
  events?: readonly PlotEvent[];
  group: ZoomGroup;
}) {
  if (!layer) return null;

  return createPortal(
    <>
      {events?.length ? <PlotEventTargets events={events} area={layer.area} /> : null}
      <PlotSelection group={group} area={layer.area} />
    </>,
    layer.over,
  );
}
