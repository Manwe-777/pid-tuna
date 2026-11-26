import { CURRENT_COLOR, VOLT_COLOR } from '../../constants';
import type { BatteryAnalysis } from '../../dsp/battery';
import { colorFor } from '../../logs/colorFor';
import { shortName } from '../../logs/shortName';
import type { LogSlot, ParsedLog } from '../../types';
import { type PlotSeries, TimeSeriesPlot } from '../common/TimeSeriesPlot';
import { BatteryStats } from './BatteryStats';

export function BatteryLogCard({
  slot,
  log,
  analysis,
  multi,
}: {
  slot: LogSlot;
  log: ParsedLog;
  analysis: BatteryAnalysis;
  multi: boolean;
}) {
  const slow = log.slow;
  const vbatSeries: PlotSeries[] = analysis.hasVoltage
    ? [{ label: 'vbat', values: slow.vbat, stroke: VOLT_COLOR, width: 1.5 }]
    : [];
  const currentSeries: PlotSeries[] = analysis.hasCurrent
    ? [{ label: 'current', values: slow.amperage, stroke: CURRENT_COLOR, width: 1.5 }]
    : [];

  return (
    <div className="diff-log">
      <h4 className="diff-log__head">
        {multi && <span className="diff-log__chip" style={{ background: colorFor(slot) }} />}
        <span className="diff-log__name">{shortName(slot)}</span>
        {analysis.cellCount != null && <span className="diff-log__vs">{analysis.cellCount}S pack</span>}
      </h4>

      <BatteryStats analysis={analysis} />

      {vbatSeries.length > 0 && (
        <div className="axis-plot" style={{ marginTop: '0.5rem' }}>
          <h5 className="axis-plot__title" style={{ fontSize: '0.78rem' }}>
            Voltage (V)
          </h5>
          <TimeSeriesPlot time={slow.time} series={vbatSeries} yLabel="V" height={180} showLegend={false} />
        </div>
      )}

      {currentSeries.length > 0 && (
        <div className="axis-plot" style={{ marginTop: '0.5rem' }}>
          <h5 className="axis-plot__title" style={{ fontSize: '0.78rem' }}>
            Current (A)
          </h5>
          <TimeSeriesPlot time={slow.time} series={currentSeries} yLabel="A" height={180} showLegend={false} />
        </div>
      )}
    </div>
  );
}
