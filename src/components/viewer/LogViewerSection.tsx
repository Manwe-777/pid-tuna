import { useMemo, useState } from 'react';

import { useViewerSelection } from '../../hooks/useViewerSelection';
import { plotEvents } from '../../logs/plotEvents';
import { ZoomGroup } from '../../plot/ZoomGroup';
import type { LogEntry } from '../../types';
import { viewerLanes } from '../../viewer/viewerLanes';
import { ViewerControls } from './ViewerControls';
import { ViewerLanePlot } from './ViewerLanePlot';

/** Every time-series signal in one place: presets, signal chips, and stacked plots that zoom together. */
export function LogViewerSection({ entries }: { entries: LogEntry[] }) {
  const viewer = useViewerSelection();
  const [zoomGroup] = useState(() => new ZoomGroup());
  const events = useMemo(() => plotEvents(entries), [entries]);
  const lanes = useMemo(() => viewerLanes(entries, viewer.selection), [entries, viewer.selection]);
  const motorCount = Math.max(...entries.map((e) => e.log.motor.length));
  const time = entries[0]!.log.time;

  return (
    <section className="plot-section">
      <h2>Log viewer</h2>
      <p className="muted">
        Pick a preset or any signals. Drag across a plot to select a stretch of time, drag its edges to adjust it, and
        double-click to zoom every plot into it. Double-click with nothing selected zooms back out.
        {entries.length > 1 && ' A signal alone in its plot is drawn in log colours; otherwise logs differ by dash.'}
      </p>
      <ViewerControls entries={entries} viewer={viewer} motorCount={motorCount} />
      {lanes.length === 0 ? (
        <p className="muted">Nothing to draw. Pick a signal, and an axis for the gyro and controller signals.</p>
      ) : (
        lanes.map((lane) => (
          <ViewerLanePlot key={lane.id} lane={lane} time={time} events={events} zoomGroup={zoomGroup} />
        ))
      )}
    </section>
  );
}
