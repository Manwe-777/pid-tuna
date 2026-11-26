import { useMemo } from 'react';
import { analyzeBattery } from '../../dsp/battery';
import type { LogEntry } from '../../types';
import { BatteryLogCard } from './BatteryLogCard';

export function BatterySection({ entries }: { entries: LogEntry[] }) {
  const multi = entries.length > 1;

  const analyses = useMemo(
    () => entries.map(({ slot, log }) => ({ slot, log, analysis: analyzeBattery(log) })),
    [entries],
  );

  const anyHasVbat = analyses.some((a) => a.analysis.hasVoltage);
  const anyHasCurrent = analyses.some((a) => a.analysis.hasCurrent);

  if (!anyHasVbat && !anyHasCurrent) {
    return (
      <section className="plot-section">
        <h2>Battery</h2>
        <p className="muted">
          No vbat or amperage telemetry in any loaded log. Check that the BF Power tab has voltage and current meters
          enabled, and that <code>vbatLatest</code> / <code>amperageLatest</code>
          are in the blackbox field whitelist.
        </p>
      </section>
    );
  }

  return (
    <section className="plot-section">
      <h2>Battery</h2>
      <p className="muted">
        Pack health under load. Internal resistance comes from voltage against current, with the slow discharge over the
        flight removed; sag is that resistance times the high-load current (mean of the top 25% of readings) and the
        peak current. Cell count follows Betaflight: resting voltage divided by the maximum cell voltage, rounded down,
        plus one. Min and max voltage ignore glitches shorter than half a second.
      </p>

      {analyses.map(({ slot, log, analysis }) => (
        <BatteryLogCard key={slot.id} slot={slot} log={log} analysis={analysis} multi={multi} />
      ))}
    </section>
  );
}
