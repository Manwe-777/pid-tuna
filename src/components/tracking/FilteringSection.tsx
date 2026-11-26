import { useMemo } from 'react';
import { AXIS_COLORS, AXIS_NAMES } from '../../constants';
import { colorFor } from '../../logs/colorFor';
import { shortName } from '../../logs/shortName';
import type { LogEntry, PlotSeries } from '../../types';
import { align } from '../../utils/align';
import { TimeSeriesPlot } from '../common/TimeSeriesPlot';

export function FilteringSection({ entries }: { entries: LogEntry[] }) {
  const primary = entries[0]!;
  const multi = entries.length > 1;
  const anyRaw = useMemo(
    () => entries.some(({ log }) => log.gyroRaw.some((arr) => arr.some((v) => v !== 0))),
    [entries],
  );
  if (!anyRaw) {
    return (
      <section className="plot-section">
        <h2>Raw vs filtered gyro</h2>
        <p className="muted">
          Unfiltered gyro is not present in these logs. Enable <code>gyroUnfilt</code> in the blackbox{' '}
          <code>debug_mode</code> to see this view.
        </p>
      </section>
    );
  }
  return (
    <section className="plot-section">
      <h2>Raw vs filtered gyro</h2>
      <p className="muted">
        {multi
          ? 'Raw shown once (gray, from primary). Filtered per log in log color (see sidebar).'
          : 'Unfiltered gyro behind the filtered controller input — shows what your gyro filter is removing.'}
      </p>
      {AXIS_NAMES.map((name, i) => {
        const N = primary.log.time.length;
        const series: PlotSeries[] = [];
        if (multi) {
          const primaryHasRaw = primary.log.gyroRaw[i]!.some((v) => v !== 0);
          if (primaryHasRaw) {
            series.push({
              label: 'Raw (primary)',
              values: primary.log.gyroRaw[i]!,
              stroke: '#5a6473',
              width: 0.75,
            });
          }
          for (const e of entries) {
            series.push({
              label: `${shortName(e.slot)} filtered`,
              values: align(e.log.gyroFilt[i]!, N),
              stroke: colorFor(e.slot),
              width: 1.4,
            });
          }
        } else {
          const hasRaw = primary.log.gyroRaw[i]!.some((v) => v !== 0);
          if (hasRaw) {
            series.push({
              label: 'Raw',
              values: primary.log.gyroRaw[i]!,
              stroke: '#5a6473',
              width: 0.75,
            });
          }
          series.push({
            label: 'Filtered',
            values: primary.log.gyroFilt[i]!,
            stroke: AXIS_COLORS[i]!,
            width: 1.4,
          });
        }
        return (
          <div key={name} className="axis-plot">
            <h3 className="axis-plot__title">
              <span className="axis-plot__dot" style={{ background: AXIS_COLORS[i] }} />
              {name}
            </h3>
            <TimeSeriesPlot time={primary.log.time} series={series} yLabel="deg/s" height={220} />
          </div>
        );
      })}
    </section>
  );
}
