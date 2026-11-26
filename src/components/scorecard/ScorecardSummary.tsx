import type { ScoreEntry, ScoreStatus } from '../../types';

export function ScorecardSummary({ entries }: { entries: ScoreEntry[] }) {
  const counts: Record<ScoreStatus, number> = { good: 0, warn: 0, bad: 0, na: 0 };
  for (const e of entries) counts[e.status]++;
  return (
    <span className="balance-axis-strip">
      {counts.bad > 0 && <span className="balance-tag balance-tag--warn">{counts.bad} bad</span>}
      {counts.warn > 0 && (
        <span
          className="balance-tag"
          style={{ background: 'rgba(255,247,93,0.12)', color: '#fff75d', border: '1px solid rgba(255,247,93,0.35)' }}
        >
          {counts.warn} warn
        </span>
      )}
      {counts.good > 0 && <span className="balance-tag balance-tag--ok">{counts.good} ok</span>}
    </span>
  );
}
