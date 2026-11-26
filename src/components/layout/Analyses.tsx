import { useMemo, useState } from 'react';

import { DASH_PATTERNS, TABS } from '../../constants';
import { useTimeWindow } from '../../hooks/useTimeWindow';
import { sliceLog } from '../../logs/sliceLog';
import type { LogEntry, LogSlot, ParsedLog, TabId } from '../../types';
import { tabHasData } from '../../utils/tabHasData';
import { TabBar } from './TabBar';
import { TabContent } from './TabContent';
import { TimeRangeControl } from './TimeRangeControl';

export function Analyses({ enabled }: { enabled: Array<{ slot: LogSlot; log: ParsedLog }> }) {
  const { duration, range, setRange } = useTimeWindow(enabled);

  const entries = useMemo<LogEntry[]>(
    () =>
      enabled.map(({ slot, log }) => ({
        slot,
        log: sliceLog(log, range),
        dash: [...(DASH_PATTERNS[slot.dashIndex % DASH_PATTERNS.length] ?? [])],
      })),
    [enabled, range],
  );

  const empty = entries[0]!.log.time.length === 0;
  const [tab, setTab] = useState<TabId>('scorecard');
  const disabledTabs = useMemo(
    () => new Set(TABS.filter(({ id }) => !tabHasData(id, entries)).map(({ id }) => id)),
    [entries],
  );

  // If the active tab loses its data (e.g. user switched to a log without GPS),
  // bounce back to the scorecard rather than rendering an empty section.
  if (disabledTabs.has(tab)) setTab('scorecard');

  return (
    <>
      <section className="window-controls">
        <TimeRangeControl max={duration} value={range} onChange={setRange} />
      </section>
      <TabBar active={tab} onChange={setTab} disabled={disabledTabs} />
      {empty ? (
        <p className="muted">Selected window contains no samples. Widen the range above.</p>
      ) : (
        <TabContent tab={tab} entries={entries} enabled={enabled} range={range} onJump={setTab} />
      )}
    </>
  );
}
