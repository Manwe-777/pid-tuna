import { useMemo, useState } from 'react';

import { buildMergedScorecard } from '../../dsp/scorecard/buildMergedScorecard';
import { buildScorecard } from '../../dsp/scorecard/buildScorecard';
import { colorFor } from '../../logs/colorFor';
import { shortName } from '../../logs/shortName';
import type { LogEntry, TabId } from '../../types';
import { makeMergedSlot } from '../../utils/makeMergedSlot';
import { MergeLogsToggle } from '../common/MergeLogsToggle';
import { ScorecardRow } from './ScorecardRow';
import { ScorecardSummary } from './ScorecardSummary';

export function ScorecardSection({ entries, onJump }: { entries: LogEntry[]; onJump: (tab: TabId) => void }) {
  const [mergeLogs, setMergeLogs] = useState(false);
  const canMerge = entries.length > 1;
  const effectiveMerge = mergeLogs && canMerge;
  const multi = entries.length > 1 && !effectiveMerge;

  const cards = useMemo(() => {
    if (effectiveMerge) {
      return [
        {
          slot: makeMergedSlot(entries),
          scorecard: buildMergedScorecard(entries.map((e) => e.log)),
        },
      ];
    }

    return entries.map(({ slot, log }) => ({ slot, scorecard: buildScorecard(log) }));
  }, [entries, effectiveMerge]);

  return (
    <section className="plot-section">
      <h2>Scorecard</h2>
      <p className="muted">
        {effectiveMerge && `Showing combined scorecard pooled across ${entries.length} logs. `}
        Triage view — green is fine, yellow worth a look, red worth digging into. Click any row to jump to the matching
        tab. Thresholds are rules of thumb for typical FPV builds.
      </p>

      <div className="controls" style={{ marginBottom: '0.5rem' }}>
        <MergeLogsToggle checked={mergeLogs} canMerge={canMerge} onChange={setMergeLogs} />
      </div>

      {cards.map(({ slot, scorecard }) => (
        <div key={slot.id} className="diff-log">
          <h4 className="diff-log__head">
            {multi && <span className="diff-log__chip" style={{ background: colorFor(slot) }} />}
            <span className="diff-log__name">{shortName(slot)}</span>
            <ScorecardSummary entries={scorecard.entries} />
          </h4>
          <div className="scorecard-grid">
            {scorecard.entries.map((e) => (
              <ScorecardRow key={e.key} entry={e} onJump={onJump} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
