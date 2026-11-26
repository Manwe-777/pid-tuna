import { useMemo } from 'react';

import { AXIS_COLORS, SAT_BAND_COLOR } from '../../constants';
import { colorFor } from '../../logs/colorFor';
import { plotEvents } from '../../logs/plotEvents';
import { shortName } from '../../logs/shortName';
import type { LogSlot, ParsedLog, PlotBand, PlotSeries, SaturationAnalysis } from '../../types';
import { TimeSeriesPlot } from '../common/TimeSeriesPlot';

export function SaturationLogCard({
  slot,
  log,
  analysis,
  multi,
}: {
  slot: LogSlot;
  log: ParsedLog;
  analysis: SaturationAnalysis;
  multi: boolean;
}) {
  const events = useMemo(() => plotEvents([{ log, slot }]), [log, slot]);
  const yaw = analysis.axes[2]?.limit;
  const limits =
    yaw != null && yaw !== analysis.itermLimit
      ? `${analysis.itermLimit.toFixed(0)} (yaw ${yaw.toFixed(0)})`
      : analysis.itermLimit.toFixed(0);
  const limitNote =
    analysis.limitSource === 'windup'
      ? `limit ${limits} = iterm_windup × pidsum_limit · takeoff to landing`
      : analysis.limitSource === 'header'
        ? `limit ${limits} · takeoff to landing`
        : `limit ${limits} (Betaflight default; this firmware doesn't log it) · takeoff to landing`;
  return (
    <div className="diff-log">
      <h4 className="diff-log__head">
        {multi && <span className="diff-log__chip" style={{ background: colorFor(slot) }} />}
        <span className="diff-log__name">{shortName(slot)}</span>
        <span className="diff-log__vs">{limitNote}</span>
      </h4>

      <div className="battery-stats">
        {analysis.axes.map((a) => {
          const cls = a.fraction >= 0.05 ? 'diff-tok--down' : a.fraction >= 0.01 ? 'diff-tok--changed' : 'diff-tok--up';
          return (
            <div key={a.axisIndex} className="battery-stat">
              <span className="battery-stat__label">{a.axisName.toUpperCase()}</span>
              <span className={`battery-stat__value ${cls}`}>{(a.fraction * 100).toFixed(1)}%</span>
              <span className="scorecard-detail">
                peak {a.peakAbs.toFixed(0)} · longest {a.longestRunSec.toFixed(2)}s · {a.runs.length} runs
              </span>
            </div>
          );
        })}
      </div>

      {analysis.axes.map((a) => {
        const series: PlotSeries[] = [
          {
            label: `iTerm ${a.axisName}`,
            values: log.iTerm[a.axisIndex]!,
            stroke: AXIS_COLORS[a.axisIndex]!,
            width: 1,
          },
        ];
        const bands: PlotBand[] = a.runs.map((r) => ({
          x0: r.t0,
          x1: r.t1,
          fill: SAT_BAND_COLOR,
        }));
        return (
          <div key={a.axisIndex} className="axis-plot mt-2">
            <h5 className="axis-plot__title text-[0.78rem]">
              <span className="axis-plot__dot" style={{ background: AXIS_COLORS[a.axisIndex] }} />
              {a.axisName} — threshold {a.threshold.toFixed(0)}
            </h5>
            <TimeSeriesPlot
              events={events}
              time={log.time}
              series={series}
              yLabel="iTerm"
              bands={bands}
              height={140}
              showLegend={false}
            />
          </div>
        );
      })}
    </div>
  );
}
