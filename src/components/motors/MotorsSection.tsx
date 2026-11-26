import { useMemo, useState } from 'react';
import { MOTOR_COLORS } from '../../constants';
import { colorFor } from '../../logs/colorFor';
import { shortName } from '../../logs/shortName';
import type { LogEntry, PlotSeries } from '../../types';
import { align } from '../../utils/align';
import { TimeSeriesPlot } from '../common/TimeSeriesPlot';

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

  // Throttle plot: rcCommand[3], shared across modes.
  const throttleSeries: PlotSeries[] = multi
    ? entries.map((e) => ({
        label: shortName(e.slot),
        values: align(e.log.rcCommand[3]!, N),
        stroke: colorFor(e.slot),
        width: 1,
      }))
    : [
        {
          label: 'Throttle',
          values: primary.log.rcCommand[3]!,
          stroke: '#bd5dff',
          width: 1,
        },
      ];

  // Motor plots.
  const motorSeries: PlotSeries[] = [];
  if (multi) {
    for (const e of entries) {
      const sig = e.log.motor[selectedMotor];
      if (!sig) continue;
      motorSeries.push({
        label: shortName(e.slot),
        values: align(sig, N),
        stroke: colorFor(e.slot),
        width: 1,
      });
    }
  } else {
    primary.log.motor.forEach((sig, idx) => {
      motorSeries.push({
        label: `Motor ${idx + 1}`,
        values: sig,
        stroke: MOTOR_COLORS[idx % MOTOR_COLORS.length]!,
        width: 1,
      });
    });
  }

  // eRPM plots (mirror motor logic).
  const erpmSeries: PlotSeries[] = [];
  if (hasERpm) {
    if (multi) {
      for (const e of entries) {
        const sig = e.log.eRpm[selectedMotor];
        if (!sig || sig.length === 0) continue;
        erpmSeries.push({
          label: shortName(e.slot),
          values: align(sig, N),
          stroke: colorFor(e.slot),
          width: 1,
        });
      }
    } else {
      primary.log.eRpm.forEach((sig, idx) => {
        erpmSeries.push({
          label: `Motor ${idx + 1}`,
          values: sig,
          stroke: MOTOR_COLORS[idx % MOTOR_COLORS.length]!,
          width: 1,
        });
      });
    }
  }

  return (
    <section className="plot-section">
      <h2>Motors & throttle</h2>
      <p className="muted">
        {multi
          ? `Multi-log: pick a motor below — each log drawn in its sidebar color. Throttle shown across all logs.`
          : 'Throttle command, per-motor PWM output, and (if logged) eRPM telemetry over time.'}
      </p>

      {multi && (
        <div className="controls">
          <span className="muted">Motor:</span>
          {Array.from({ length: motorCount }, (_, idx) => (
            <label key={idx} className={`signal-chip${selectedMotor === idx ? ' signal-chip--on' : ''}`}>
              <input
                type="radio"
                name="motor-pick"
                checked={selectedMotor === idx}
                onChange={() => setSelectedMotor(idx)}
              />
              <span className="signal-chip__swatch" style={{ background: MOTOR_COLORS[idx % MOTOR_COLORS.length] }} />M
              {idx + 1}
            </label>
          ))}
        </div>
      )}

      <div className="axis-plot">
        <h3 className="axis-plot__title">Throttle command</h3>
        <TimeSeriesPlot time={primary.log.time} series={throttleSeries} yLabel="PWM" height={180} />
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
