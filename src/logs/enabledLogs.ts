import type { LogSlot, ParsedLog } from '../types';

/** Loaded logs that are toggled on for plotting. */
export function enabledLogs(slots: LogSlot[]): Array<{ slot: LogSlot; log: ParsedLog }> {
  const out: Array<{ slot: LogSlot; log: ParsedLog }> = [];
  for (const s of slots) {
    if (!s.enabled) continue;
    if (s.state.kind !== 'ready') continue;
    out.push({ slot: s, log: s.state.log });
  }
  return out;
}
