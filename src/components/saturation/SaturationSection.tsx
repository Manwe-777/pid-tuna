import { useMemo } from 'react';
import { analyzeSaturation } from '../../dsp/saturation';
import type { LogEntry } from '../../types';
import { SaturationLogCard } from './SaturationLogCard';

export function SaturationSection({ entries }: { entries: LogEntry[] }) {
  const multi = entries.length > 1;
  const analyses = useMemo(
    () => entries.map(({ slot, log }) => ({ slot, log, analysis: analyzeSaturation(log) })),
    [entries],
  );

  return (
    <section className="plot-section">
      <h2>I-term saturation</h2>
      <p className="muted">
        Highlights time spans where I-term hit (or came close to) its configured limit per axis. Sustained saturation
        means the controller ran out of authority — usually a sign of an underpowered or unbalanced craft, or aggressive
        maneuvering beyond what the tune can handle.
      </p>
      {analyses.map(({ slot, log, analysis }) => (
        <SaturationLogCard key={slot.id} slot={slot} log={log} analysis={analysis} multi={multi} />
      ))}
    </section>
  );
}
