import { useMemo } from 'react';
import { AXIS_COLORS, AXIS_NAMES } from '../../constants';
import type { AxisStepWithSlot, LogDot, PlotSeries, StepSettings } from '../../types';
import { align } from '../../utils/align';
import { hexWithAlpha } from '../../utils/hexWithAlpha';
import { stepMetricOption } from '../../utils/stepMetricOption';
import { LogDotPlot } from '../common/LogDotPlot';
import { TimeSeriesPlot } from '../common/TimeSeriesPlot';
import { StepFrequencyPlot } from './StepFrequencyPlot';
import { StepStatsTable } from './StepStatsTable';

export function StepResponseAxisPanel({
  axisIndex,
  perLog,
  settings,
}: {
  axisIndex: number;
  perLog: AxisStepWithSlot[];
  settings: StepSettings;
}) {
  const axisColor = AXIS_COLORS[axisIndex]!;
  const axisName = AXIS_NAMES[axisIndex]!;
  const primary = perLog.find((p) => p.data.time.length > 0) ?? perLog[0]!;
  const time = primary.data.time;
  const multi = perLog.length > 1;
  const { showSegments, showSpread, showFrequency, yMax, dotMetrics } = settings;

  const series = useMemo<PlotSeries[]>(() => {
    const out: PlotSeries[] = [];
    for (const { label, color: entryColor, dash, data } of perLog) {
      if (data.mean.length === 0) continue;
      const color = multi ? entryColor : axisColor;
      const mean = align(data.mean, time.length);
      if (!multi && showSegments) {
        const segColor = hexWithAlpha(axisColor, 0.18);
        for (const seg of data.segments) out.push({ label: '', values: seg, stroke: segColor, width: 0.6 });
      }
      if (showSpread && data.spread.length === data.mean.length) {
        const bandColor = hexWithAlpha(color, 0.55);
        const lo = mean.map((v, k) => v - (data.spread[k] ?? 0));
        const hi = mean.map((v, k) => v + (data.spread[k] ?? 0));
        out.push({ label: '', values: lo, stroke: bandColor, width: 1, dash: [3, 3] });
        out.push({ label: '', values: hi, stroke: bandColor, width: 1, dash: [3, 3] });
      }
      out.push({
        label: multi ? label : 'Estimate',
        values: mean,
        stroke: color,
        width: 2,
        dash: multi && dash.length ? dash : undefined,
      });
    }
    return out;
  }, [perLog, time.length, axisColor, multi, showSegments, showSpread]);

  const empty = perLog.every((p) => p.data.mean.length === 0);

  const dotPlots = dotMetrics.map((key) => {
    const option = stepMetricOption(key);
    const dots: LogDot[] = perLog.map((p) => ({
      label: p.label,
      color: p.color,
      value: p.data.metrics[key],
      spread: p.data.metricSpread[key] ?? null,
    }));
    return { option, dots };
  });

  const statsRows = perLog.map((p) => ({
    id: p.id,
    label: p.label,
    color: multi ? p.color : axisColor,
    windows: p.data.segments.length,
    metrics: p.data.metrics,
  }));

  const frequencyEntries = perLog
    .filter((p) => p.data.frequency != null)
    .map((p) => ({ label: p.label, color: multi ? p.color : axisColor, response: p.data.frequency! }));

  return (
    <div className="axis-plot">
      <h3 className="axis-plot__title">
        <span className="axis-plot__dot" style={{ background: axisColor }} />
        {axisName}
      </h3>
      <div className="step-axis-row">
        {!empty ? (
          <div className="step-axis-row__plot">
            <TimeSeriesPlot
              time={time}
              series={series}
              yLabel="× setpoint"
              xLabel="ms"
              height={220}
              yMin={0}
              yMax={yMax}
              showLegend={false}
            />
          </div>
        ) : (
          <p className="muted step-axis-row__plot">No usable windows on this axis.</p>
        )}
        <div className="step-axis-row__dots">
          {dotPlots.map(({ option, dots }, idx) => (
            <LogDotPlot
              key={`${option.key}-${idx}`}
              dots={dots}
              title={`${axisName} ${option.label.toLowerCase()}`}
              unit={option.unit || undefined}
              referenceY={option.reference}
              yMin={option.axis?.[0]}
              yMax={option.axis?.[1]}
              xLabel={settings.splitBy !== 'none' ? 'band' : 'log #'}
              height={220}
            />
          ))}
        </div>
      </div>
      {!empty && <StepStatsTable rows={statsRows} />}
      {!empty && showFrequency && frequencyEntries.length > 0 && (
        <div className="step-freq">
          <div className="step-freq__caption muted">
            Frequency response — solid: tracking |T| (−3 dB marks the bandwidth); dashed: disturbance sensitivity |1 −
            T| (above 0 dB, disturbances get amplified).
          </div>
          <StepFrequencyPlot entries={frequencyEntries} />
        </div>
      )}
    </div>
  );
}
