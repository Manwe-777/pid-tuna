import { useMemo } from 'react';

import type { FrequencyResponse } from '../../dsp/stepFrequencyResponse';
import { type PlotSeries, TimeSeriesPlot } from '../common/TimeSeriesPlot';

export interface StepFrequencyEntry {
  label: string;
  color: string;
  response: FrequencyResponse;
}

const SENSITIVITY_DASH = [6, 4];

/** Closed-loop tracking |T| (solid) and disturbance sensitivity |1 − T| (dashed) per log, in dB. */
export function StepFrequencyPlot({ entries }: { entries: StepFrequencyEntry[] }) {
  const reference = entries[0]?.response.frequencies;

  const series = useMemo<PlotSeries[]>(() => {
    if (!reference) return [];

    return entries.flatMap((e) => [
      {
        label: `${e.label} tracking`,
        values: fit(e.response.magnitudeDb, reference.length),
        stroke: e.color,
        width: 2,
      },
      {
        label: `${e.label} sensitivity`,
        values: fit(e.response.sensitivityDb, reference.length),
        stroke: e.color,
        width: 1.2,
        dash: SENSITIVITY_DASH,
      },
    ]);
  }, [entries, reference]);

  if (!reference || series.length === 0) return null;

  return (
    <TimeSeriesPlot
      time={reference}
      series={series}
      xLabel="Hz"
      yLabel="dB"
      yMin={-20}
      yMax={10}
      height={200}
      showLegend={false}
    />
  );
}

function fit(values: Float32Array, length: number): Float32Array {
  if (values.length === length) return values;

  const out = new Float32Array(length).fill(Number.NaN);
  out.set(values.subarray(0, length));

  return out;
}
