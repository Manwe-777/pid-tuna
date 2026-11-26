import { AXIS_COLORS } from '../../constants';
import type { PlotMarker, PsdAxisItem } from '../../types';
import { psdPlotSeries } from '../../utils/psdPlotSeries';
import { TimeSeriesPlot } from '../common/TimeSeriesPlot';

interface Props {
  name: string;
  axis: number;
  items: PsdAxisItem[];
  multi: boolean;
  nyquist: number;
  yMin: number;
  yMax: number;
  markers: PlotMarker[];
}

/** One axis: the full-range PSD beside a sub-100 Hz zoom, or a note when no selected signal is there. */
export function PsdAxisPlot({ name, axis, items, multi, nyquist, yMin, yMax, markers }: Props) {
  const title = (
    <h3 className="axis-plot__title">
      <span className="axis-plot__dot" style={{ background: AXIS_COLORS[axis] }} />
      {name}
    </h3>
  );

  if (items.length === 0) {
    return (
      <div className="axis-plot">
        {title}
        <p className="muted">No data for selected signals on this axis.</p>
      </div>
    );
  }

  const series = psdPlotSeries(items, axis, multi);
  const freq = items[0]!.freq;
  const common = { time: freq, series, yLabel: 'dB', yMin, yMax, markers, height: 220 };

  return (
    <div className="axis-plot">
      {title}
      <div className="psd-grid">
        <TimeSeriesPlot {...common} syncGroup="hz" xLabel="Hz" xMin={0} xMax={nyquist} />
        <TimeSeriesPlot {...common} syncGroup="hz-sub100" xLabel="Hz (sub-100)" xMin={0} xMax={100} />
      </div>
    </div>
  );
}
