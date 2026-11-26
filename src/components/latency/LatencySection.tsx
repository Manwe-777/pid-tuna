import { useMemo, useState } from 'react';

import { AXIS_COLORS, AXIS_NAMES, DELAY_REFERENCE_HZ } from '../../constants';
import { filterDelaysForLog } from '../../dsp/filters/filterDelaysForLog';
import { latencyForLog } from '../../dsp/latencyForLog';
import { colorFor } from '../../logs/colorFor';
import { shortName } from '../../logs/shortName';
import type { AxisLatency, LogEntry } from '../../types';
import { FilterDelayTable } from './FilterDelayTable';
import { LatencyCell } from './LatencyCell';

export function LatencySection({ entries }: { entries: LogEntry[] }) {
  const multi = entries.length > 1;
  const [delayHz, setDelayHz] = useState<number>(DELAY_REFERENCE_HZ);

  const perLog = useMemo(() => {
    return entries.map(({ slot, log }) => {
      const axes: AxisLatency[] = AXIS_NAMES.map((_n, axis) => {
        return { axis, ...latencyForLog(log, axis) };
      });
      const delays = filterDelaysForLog(log, delayHz);
      return { slot, log, axes, delays };
    });
  }, [entries, delayHz]);

  return (
    <section className="plot-section">
      <h2>Latency</h2>
      <p className="muted">
        Setpoint→gyro tracking delay via cross-correlation — works on any flight data (no clean step needed). The filter
        breakdown below shows how much delay each filter adds in the band the PID loop controls.
      </p>

      <div className="diff-section">
        <h3>Tracking latency (setpoint → gyro)</h3>
        <table className="diff-table">
          <thead>
            <tr>
              {multi && <th></th>}
              {multi && <th>Log</th>}
              {AXIS_NAMES.map((name, i) => (
                <th key={name}>
                  <span className="axis-chip" style={{ background: AXIS_COLORS[i] }}>
                    {name.toUpperCase()}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {perLog.map(({ slot, axes }) => (
              <tr key={slot.id}>
                {multi && (
                  <th>
                    <span className="diff-log__chip" style={{ background: colorFor(slot) }} />
                  </th>
                )}
                {multi && <th>{shortName(slot)}</th>}
                {axes.map((a) => (
                  <td key={a.axis}>
                    <LatencyCell result={a} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted" style={{ fontSize: '0.78rem', marginTop: '0.5rem' }}>
          Faded values had low correlation or low stick activity in the window — widen the time range or pick a more
          active flight segment.
        </p>
      </div>

      <div className="diff-section">
        <h3>
          Filter delay at{' '}
          <input
            type="number"
            min={1}
            max={200}
            step="1"
            value={delayHz}
            onChange={(e) =>
              setDelayHz(Math.min(200, Math.max(1, Number.parseFloat(e.target.value) || DELAY_REFERENCE_HZ)))
            }
            style={{ width: '4rem' }}
            aria-label="Frequency the delay is reported at"
          />{' '}
          Hz
        </h3>
        {perLog.map(({ slot, delays }) => (
          <div key={slot.id} className="diff-log">
            <h4 className="diff-log__head">
              {multi && <span className="diff-log__chip" style={{ background: colorFor(slot) }} />}
              <span className="diff-log__name">{shortName(slot)}</span>
              <span className="diff-log__vs">
                gyro {delays.gyroDelayMs.toFixed(2)} ms · D path {delays.dPathDelayMs.toFixed(2)} ms
              </span>
            </h4>
            {delays.entries.length === 0 ? (
              <p className="muted">No filters configured.</p>
            ) : (
              <FilterDelayTable entries={delays.entries} />
            )}
          </div>
        ))}
        <p className="muted" style={{ fontSize: '0.78rem', marginTop: '0.5rem' }}>
          Computed with Betaflight&apos;s filter maths: gyro filters at the gyro loop rate, D-term filters at the PID
          loop rate. Gyro filters delay every PID term; D-term filters only add to the D path. Dynamic filters are shown
          where they add the most delay, and RPM notches at the log&apos;s median motor frequency when RPM telemetry is
          logged.
        </p>
      </div>
    </section>
  );
}
