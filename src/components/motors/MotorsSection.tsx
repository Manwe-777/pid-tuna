import { useMemo, useState } from 'react';

import type { LogEntry } from '../../types';
import { motorChannelSeries } from '../../utils/motorChannelSeries';
import { throttleSeries } from '../../utils/throttleSeries';
import { TimeSeriesPlot } from '../common/TimeSeriesPlot';
import { MotorPicker } from './MotorPicker';

export function MotorsSection({ entries }: { entries: LogEntry[] }) {
  const primary = entries[0]!;
  const multi = entries.length > 1;

  const motorCount = primary.log.motor.length;
  const hasERpm = useMemo(
    () => entries.some(({ log }) => log.eRpm.length > 0 && log.eRpm.some((arr) => arr.some((v) => v > 0))),
    [entries],
  );

  // In multi-log mode, pick a single motor to compare across logs.
  const [selectedMotor, setSelectedMotor] = useState<number>(0);

  if (motorCount === 0) {
    return (
      <section className="plot-section">
        <h2>Motors & throttle</h2>
        <p className="muted">No motor channels logged.</p>
      </section>
    );
  }

  const N = primary.log.time.length;

  const throttle = throttleSeries(entries, N);
  const motorSeries = motorChannelSeries(entries, (log) => log.motor, selectedMotor, { length: N, skipEmpty: false });
  // eRPM plots mirror the motor plots.
  const erpmSeries = hasERpm
    ? motorChannelSeries(entries, (log) => log.eRpm, selectedMotor, { length: N, skipEmpty: true })
    : [];

  return (
    <section className="plot-section">
      <h2>Motors & throttle</h2>
      <p className="muted">
        {multi
          ? `Multi-log: pick a motor below — each log drawn in its sidebar color. Throttle shown across all logs.`
          : 'Throttle command, per-motor PWM output, and (if logged) eRPM telemetry over time.'}
      </p>

      {multi && <MotorPicker count={motorCount} selected={selectedMotor} onSelect={setSelectedMotor} />}

      <div className="axis-plot">
        <h3 className="axis-plot__title">Throttle command</h3>
        <TimeSeriesPlot time={primary.log.time} series={throttle} yLabel="PWM" height={180} />
      </div>

      <div className="axis-plot">
        <h3 className="axis-plot__title">Motor output{multi ? ` — M${selectedMotor + 1}` : 's'}</h3>
        <TimeSeriesPlot time={primary.log.time} series={motorSeries} yLabel="PWM" height={220} />
      </div>

      {hasERpm && (
        <div className="axis-plot">
          <h3 className="axis-plot__title">eRPM{multi ? ` — M${selectedMotor + 1}` : ''}</h3>
          <TimeSeriesPlot time={primary.log.time} series={erpmSeries} yLabel="eRPM/100" height={200} />
        </div>
      )}
    </section>
  );
}
