import { TimeSeriesPlot } from '../common/TimeSeriesPlot';

/** The spectrum at the cursor time, as a line. */
export function SpectralSlicePlot(p: {
  slice: { freq: Float32Array; values: Float32Array };
  cursorTime: number | null;
  label: string;
  color: string;
  maxFreq: number;
  floorDb: number;
  ceilDb: number;
}) {
  return (
    <div className="axis-plot" style={{ marginTop: '0.5rem' }}>
      <h3 className="axis-plot__title">
        Spectral slice at {p.cursorTime != null ? `${p.cursorTime.toFixed(2)} s` : '—'}
      </h3>
      <TimeSeriesPlot
        time={p.slice.freq}
        series={[{ label: p.label, values: p.slice.values, stroke: p.color, width: 1.4 }]}
        yLabel="dB"
        xLabel="Hz"
        xMin={0}
        xMax={p.maxFreq}
        yMin={p.floorDb}
        yMax={p.ceilDb}
        height={180}
      />
    </div>
  );
}
