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
    <div className="axis-plot mt-2">
      <h5 className="axis-plot__title text-[0.78rem]">{props.title}</h5>
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
