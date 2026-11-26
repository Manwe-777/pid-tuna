import type { LogEntry, ParsedLog, TabId } from '../types';

/**
 * Whether the loaded logs collectively contain the data each tab needs. A tab
 * is enabled if *any* loaded log has the required data; tabs whose data is
 * missing from every log get a dot and are non-clickable.
 */
export function tabHasData(tabId: TabId, entries: LogEntry[]): boolean {
  const some = (pick: (p: ParsedLog['presence']) => boolean) => entries.some((e) => pick(e.log.presence));

  switch (tabId) {
    case 'filtering':
    case 'filterSim':
      return some((p) => p.gyroRaw);
    case 'pid':
      return some((p) => p.pidTerms);
    case 'saturation':
      return some((p) => p.iTerm);
    case 'motors':
    case 'balance':
      return some((p) => p.motors);
    case 'battery':
      return some((p) => p.vbat || p.amperage);
    case 'gps':
      return some((p) => p.gps);
    default:
      return true;
  }
}
