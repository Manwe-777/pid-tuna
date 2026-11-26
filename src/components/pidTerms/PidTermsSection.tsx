import { useMemo, useState } from 'react';

import { AXIS_COLORS, AXIS_NAMES, PID_TERM_DEFS } from '../../constants';
import { colorFor } from '../../logs/colorFor';
import { plotEvents } from '../../logs/plotEvents';
import { shortName } from '../../logs/shortName';
import type { LogEntry, PidTermKey, PlotSeries } from '../../types';
import { align } from '../../utils/align';
import { extractSignal } from '../../utils/extractSignal';
import { TimeSeriesPlot } from '../common/TimeSeriesPlot';

export function PidTermsSection({ entries }: { entries: LogEntry[] }) {
  const primary = entries[0]!;
  const multi = entries.length > 1;
  const events = useMemo(() => plotEvents(entries), [entries]);

  const [selected, setSelected] = useState<ReadonlySet<PidTermKey>>(() => new Set<PidTermKey>(['pterm', 'iterm']));
  const singleSelected: PidTermKey = multi ? ([...selected][0] ?? 'pterm') : 'pterm';

  const toggleTerm = (key: PidTermKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const pickSingleTerm = (key: PidTermKey) => setSelected(new Set([key]));

  const availability = useMemo<Record<PidTermKey, boolean>>(() => {
    const out = {} as Record<PidTermKey, boolean>;

    for (const def of PID_TERM_DEFS) {
      const sample = extractSignal(primary.log, def.signalKey, 0);
      out[def.key] = !!sample && sample.length > 0 && sample.some((v) => v !== 0);
    }

    return out;
  }, [primary.log]);

  const activeDefs = useMemo(
    () =>
      multi ? PID_TERM_DEFS.filter((d) => d.key === singleSelected) : PID_TERM_DEFS.filter((d) => selected.has(d.key)),
    [multi, singleSelected, selected],
  );

  return (
    <section className="plot-section">
      <h2>PID terms</h2>
      <p className="muted">
        {multi
          ? 'Multi-log: pick one term — each log drawn in its sidebar color.'
          : 'Per-axis controller term contributions over time. Diagnose I-term wind-up, F-term overshoots, D-term spikes.'}
      </p>

      <div className="signal-grid">
        {PID_TERM_DEFS.map((def) => {
          const present = availability[def.key];
          const checked = multi ? singleSelected === def.key : selected.has(def.key);
          return (
            <label
              key={def.key}
              className={`signal-chip${checked ? ' signal-chip--on' : ''}${present ? '' : ' signal-chip--off'}`}
            >
              <input
                type={multi ? 'radio' : 'checkbox'}
                name={multi ? 'pid-term' : undefined}
                checked={checked}
                disabled={!present}
                onChange={() => (multi ? pickSingleTerm(def.key) : toggleTerm(def.key))}
              />
              <span className="signal-chip__swatch" style={{ background: def.color }} />
              {def.label}
              {!present && <span className="signal-chip__note">(not logged)</span>}
            </label>
          );
        })}
      </div>

      {AXIS_NAMES.map((name, i) => {
        const N = primary.log.time.length;
        const series: PlotSeries[] = [];

        for (const def of activeDefs) {
          for (const entry of entries) {
            const sig = extractSignal(entry.log, def.signalKey, i);
            if (!sig || sig.length === 0) continue;
            const values = align(sig, N);

            if (multi) {
              series.push({
                label: shortName(entry.slot),
                values,
                stroke: colorFor(entry.slot),
                width: 1.5,
              });
            } else {
              series.push({
                label: def.label,
                values,
                stroke: def.color,
                width: 1.2,
              });
            }
          }
        }

        return (
          <div key={name} className="axis-plot">
            <h3 className="axis-plot__title">
              <span className="axis-plot__dot" style={{ background: AXIS_COLORS[i] }} />
              {name}
            </h3>
            {series.length > 0 ? (
              <TimeSeriesPlot time={primary.log.time} events={events} series={series} yLabel="output" height={220} />
            ) : (
              <p className="muted">No data for selected terms on this axis.</p>
            )}
          </div>
        );
      })}
    </section>
  );
}
