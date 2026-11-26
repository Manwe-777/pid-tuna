import { MOTOR_COLORS } from '../../constants';
import type { BalanceAnalysis, PlotSeries } from '../../types';
import { TimeSeriesPlot } from '../common/TimeSeriesPlot';

export function BalancePsdPlot({ analysis }: { analysis: BalanceAnalysis }) {
  const psds = analysis.motorPsds;
  if (psds.length === 0 || psds[0]!.frequencies.length === 0) return null;
  const freq = psds[0]!.frequencies;
  const nyquist = freq[freq.length - 1]!;

  const highlightMotor = analysis.singleMotorOutlier?.motorIndex ?? null;
  const series: PlotSeries[] = psds.map((p, i) => ({
    label: `M${i + 1}`,
    values: p.psdDb,
    stroke: MOTOR_COLORS[i % MOTOR_COLORS.length]!,
    width: i === highlightMotor ? 2 : 1,
  }));

  return (
    <div className="axis-plot mt-3">
      <h5 className="axis-plot__title text-[0.78rem]">
        Motor command PSD — spikes on one motor only = that motor is the source
      </h5>
      <TimeSeriesPlot
        time={freq}
        series={series}
        yLabel="dB"
        xLabel="Hz"
        xMin={0}
        xMax={Math.min(nyquist, 500)}
        height={200}
      />
    </div>
  );
}
