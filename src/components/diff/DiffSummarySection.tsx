import { useMemo } from 'react';
import { AXIS_NAMES } from '../../constants';
import { computePsd } from '../../dsp/spectrum/computePsd';
import type { LogEntry } from '../../types';
import { computeAxisSteps } from '../../utils/computeAxisSteps';
import { parseLogStartMs } from '../../utils/parseLogStartMs';
import { NoiseDiffBlock } from './NoiseDiffBlock';
import { StepDiffBlock } from './StepDiffBlock';
import { TuneDiffBlock } from './TuneDiffBlock';

export function DiffSummarySection({ entries }: { entries: LogEntry[] }) {
  // Order by Log start datetime if every log has one; otherwise use sidebar order.
  const ordered = useMemo(() => {
    const stamps = entries.map((e) => parseLogStartMs(e.log));
    if (stamps.every((t) => t != null)) {
      const indexed = entries.map((e, i) => ({ e, t: stamps[i]! }));
      indexed.sort((a, b) => a.t - b.t);
      return indexed.map((x) => x.e);
    }
    return entries;
  }, [entries]);

  const steps = useMemo(() => ordered.map(({ slot, log }) => ({ slot, axes: computeAxisSteps(log) })), [ordered]);

  const psds = useMemo(
    () =>
      ordered.map(({ slot, log }) => ({
        slot,
        axes: AXIS_NAMES.map((_n, i) => computePsd(log.gyroFilt[i]!, log.setup.sampleRateHz, { windowSize: 1024 })),
      })),
    [ordered],
  );

  if (ordered.length < 2) {
    return (
      <section className="plot-section">
        <h2>Diff summary</h2>
        <p className="muted">
          Load and enable a second log in the sidebar to compare. Drag log cards in the sidebar to set chronological
          order (used when logs don&apos;t carry a start-time header).
        </p>
      </section>
    );
  }

  const allTimed = ordered.every((e) => parseLogStartMs(e.log) != null);

  return (
    <section className="plot-section">
      <h2>Diff summary</h2>
      <p className="muted">
        {allTimed ? 'Logs sorted chronologically by start datetime.' : 'Logs in sidebar order — drag cards to reorder.'}{' '}
        Values compared to the prior log: <span className="diff-tok--up">green</span> = increased,{' '}
        <span className="diff-tok--down">red</span> = decreased.
      </p>

      <div className="diff-section">
        <h3>Tune settings</h3>
        {ordered.map((entry, i) => (
          <TuneDiffBlock key={entry.slot.id} entry={entry} prev={i > 0 ? ordered[i - 1]! : null} />
        ))}
      </div>

      <div className="diff-section">
        <h3>Step response</h3>
        {steps.map((s, i) => (
          <StepDiffBlock key={s.slot.id} current={s} prev={i > 0 ? steps[i - 1]! : null} />
        ))}
      </div>

      <div className="diff-section">
        <h3>Filtered gyro noise floor</h3>
        {psds.map((p, i) => (
          <NoiseDiffBlock key={p.slot.id} current={p} prev={i > 0 ? psds[i - 1]! : null} />
        ))}
      </div>
    </section>
  );
}
