import type { ZoomGroup } from '../../plot/ZoomGroup';
import type { PlotEvent, ViewerLane } from '../../types';
import { TimeSeriesPlot } from '../common/TimeSeriesPlot';

/** One lane of the log viewer: its title and a plot that zooms with the others. */
export function ViewerLanePlot({
  lane,
  time,
  events,
  zoomGroup,
}: {
  lane: ViewerLane;
  time: Float32Array;
  events: readonly PlotEvent[];
  zoomGroup: ZoomGroup;
}) {
  return (
    <div className="axis-plot">
      <h3 className="axis-plot__title">
        {lane.dot && <span className="axis-plot__dot" style={{ background: lane.dot }} />}
        {lane.title}
      </h3>
      {lane.series.length > 0 ? (
        <TimeSeriesPlot
          time={time}
          events={events}
          series={lane.series}
          yLabel={lane.yLabel}
          height={lane.height}
          exportName={`${lane.title} ${lane.yLabel}`}
          zoomGroup={zoomGroup}
          syncKey="log-viewer"
        />
      ) : (
        <p className="muted">None of the chosen signals are logged for {lane.title.toLowerCase()}.</p>
      )}
    </div>
  );
}
