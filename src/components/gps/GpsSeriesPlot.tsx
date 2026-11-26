import type { PlotMarker, PlotSeries } from '../../types';
import { TimeSeriesPlot } from '../common/TimeSeriesPlot';

/** A small titled GPS chart (altitude or speed) with the playback marker. */
export function GpsSeriesPlot(props: {
  title: string;
  time: Float32Array;
  series: PlotSeries[];
  yLabel: string;
  markers: PlotMarker[];
  segmentStrokeColors?: readonly string[];
}) {
  return (
    <div className="axis-plot" style={{ marginTop: '0.5rem' }}>
      <h5 className="axis-plot__title" style={{ fontSize: '0.78rem' }}>
        {props.title}
      </h5>
      <TimeSeriesPlot
        time={props.time}
        series={props.series}
        yLabel={props.yLabel}
        height={180}
        showLegend={false}
        markers={props.markers}
        segmentStrokeColors={props.segmentStrokeColors}
      />
    </div>
  );
}
