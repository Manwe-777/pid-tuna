import { useMemo } from 'react';

import { AXIS_COLORS, AXIS_NAMES } from '../../constants';
import { colorFor } from '../../logs/colorFor';
import { plotEvents } from '../../logs/plotEvents';
import { shortName } from '../../logs/shortName';
import type { LogEntry, PlotSeries } from '../../types';
import { align } from '../../utils/align';
import { TimeSeriesPlot } from '../common/TimeSeriesPlot';

export function TrackingSection({ entries }: { entries: LogEntry[] }) {
  const primary = entries[0]!;
  const multi = entries.length > 1;
  const events = useMemo(() => plotEvents(entries), [entries]);
  return (
    <section className="plot-section">
      <h2>Setpoint vs gyro</h2>
      <p className="muted">
        {multi
          ? 'Setpoint shown once (gray, from primary log). Gyro per log in log color (see sidebar).'
          : 'How well the filtered gyro tracks the stick command. Tighter overlap = tighter tune.'}
      </p>
      {AXIS_NAMES.map((name, i) => {
        const N = primary.log.time.length;
        const series: PlotSeries[] = [];

        if (multi) {
          // Single shared setpoint reference (primary), gyro per log in log color.
          series.push({
            label: 'Setpoint',
            values: primary.log.setpoint[i]!,
            stroke: '#7a8597',
            width: 1,
          });

          for (const e of entries) {
            series.push({
              label: `${shortName(e.slot)} gyro`,
              values: align(e.log.gyroFilt[i]!, N),
              stroke: colorFor(e.slot),
              width: 1.5,
            });
          }
        } else {
          // Single log: classic axis-color view.
          series.push(
            { label: 'Setpoint', values: primary.log.setpoint[i]!, stroke: '#7a8597', width: 1 },
            { label: 'Gyro', values: primary.log.gyroFilt[i]!, stroke: AXIS_COLORS[i]!, width: 1.5 },
          );
        }

        return (
          <div key={name} className="axis-plot">
            <h3 className="axis-plot__title">
              <span className="axis-plot__dot" style={{ background: AXIS_COLORS[i] }} />
              {name}
            </h3>
            <TimeSeriesPlot time={primary.log.time} events={events} series={series} yLabel="deg/s" height={220} />
          </div>
        );
      })}
    </section>
  );
}
