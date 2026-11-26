import { useMemo, useState } from 'react';
import { analyzeMotorBalance } from '../../dsp/balance/analyzeMotorBalance';
import { combineMotorBalances } from '../../dsp/balance/combineMotorBalances';
import { colorFor } from '../../logs/colorFor';
import { shortName } from '../../logs/shortName';
import type { BalanceAnalysis, LogEntry, LogSlot } from '../../types';
import { makeMergedSlot } from '../../utils/makeMergedSlot';
import { MergeLogsToggle } from '../common/MergeLogsToggle';
import { BalanceAxisStrip } from './BalanceAxisStrip';
import { BalancePsdPlot } from './BalancePsdPlot';
import { BalanceStatsTable } from './BalanceStatsTable';

export function BalanceSection({ entries }: { entries: LogEntry[] }) {
  const motorCount = entries[0]!.log.motor.length;
  const [mergeLogs, setMergeLogs] = useState(false);
  const canMerge = entries.length > 1;
  const effectiveMerge = mergeLogs && canMerge;
  const multi = entries.length > 1 && !effectiveMerge;

  const analyses = useMemo<Array<{ slot: LogSlot; analysis: BalanceAnalysis }>>(() => {
    const perLog = entries.map(({ slot, log }) => ({ slot, analysis: analyzeMotorBalance(log) }));
    if (!effectiveMerge) return perLog;
    return [
      {
        slot: makeMergedSlot(entries),
        analysis: combineMotorBalances(perLog.map((p) => p.analysis)),
      },
    ];
  }, [entries, effectiveMerge]);

  if (motorCount === 0) {
    return (
      <section className="plot-section">
        <h2>Motor balance</h2>
        <p className="muted">No motor channels logged.</p>
      </section>
    );
  }

  return (
    <section className="plot-section">
      <h2>Motor balance</h2>
      <p className="muted">
        {effectiveMerge && `Pooling ${entries.length} logs into one combined view. `}
        Per-motor command stats and noise PSD, takeoff to landing. Output is measured above the motor&apos;s zero point,
        so DShot and PWM read alike. A motor whose mean output is meaningfully above the others is fighting harder —
        often a bent prop, weak motor, or off-centre weight. Spikes on one motor&apos;s PSD that aren&apos;t on the
        others point to that motor specifically.
      </p>

      <div className="controls" style={{ marginBottom: '0.5rem' }}>
        <MergeLogsToggle checked={mergeLogs} canMerge={canMerge} onChange={setMergeLogs} />
      </div>

      {analyses.map(({ slot, analysis }) => (
        <div key={slot.id} className="diff-log">
          <h4 className="diff-log__head">
            {multi && <span className="diff-log__chip" style={{ background: colorFor(slot) }} />}
            <span className="diff-log__name">{shortName(slot)}</span>
            <BalanceAxisStrip
              axes={analysis.axes}
              dominantAxis={analysis.dominantAxis}
              singleOutlier={analysis.singleMotorOutlier}
            />
          </h4>
          <BalanceStatsTable analysis={analysis} />
          <BalancePsdPlot analysis={analysis} />
        </div>
      ))}

      <p className="muted" style={{ fontSize: '0.78rem', marginTop: '0.5rem' }}>
        Axes are projections of the per-motor mean onto pitch / roll / yaw using the default Quad-X mixer (M1=RR/CW,
        M2=FR/CCW, M3=RL/CCW, M4=FL/CW): pitch is rear minus front, roll is right minus left, yaw is CCW minus CW motors
        (flipped for reversed props). Interpret against your own motor mapping.
      </p>
    </section>
  );
}
