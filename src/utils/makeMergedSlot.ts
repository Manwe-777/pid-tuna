import type { LogEntry, LogSlot } from '../types';

/**
 * Build a synthetic LogSlot representing N pooled logs. Reuses the first log's
 * parsed data so any code reading `slot.state.log` (setup, fileName, etc.) sees
 * a valid log; only the displayed filename is replaced with "Merged (N logs)".
 */
export function makeMergedSlot(entries: LogEntry[]): LogSlot {
  const first = entries[0]?.slot;

  if (!first || first.state.kind !== 'ready') {
    return first ?? ({} as LogSlot);
  }

  return {
    id: '__merged__',
    enabled: true,
    dashIndex: 0,
    state: {
      kind: 'ready',
      log: { ...first.state.log, fileName: `Merged (${entries.length} logs)` },
    },
  };
}
