import { SCORECARD_JUMP } from '../../constants';
import type { ScoreEntry } from '../../dsp/scorecard';
import type { TabId } from '../../types';

export function ScorecardRow({ entry, onJump }: { entry: ScoreEntry; onJump: (tab: TabId) => void }) {
  const target = SCORECARD_JUMP[entry.key];
  const clickable = target != null;
  return (
    <button
      type="button"
      className={`scorecard-row scorecard-row--${entry.status}${clickable ? '' : ' scorecard-row--static'}`}
      onClick={clickable ? () => onJump(target) : undefined}
      disabled={!clickable}
    >
      <span className={`scorecard-dot scorecard-dot--${entry.status}`} />
      <div className="scorecard-text">
        <span className="scorecard-key">{entry.key}</span>
        <span className="scorecard-value">{entry.value}</span>
        {entry.detail && <span className="scorecard-detail">{entry.detail}</span>}
      </div>
    </button>
  );
}
