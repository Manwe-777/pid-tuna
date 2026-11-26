import type { LogEntry, ViewerSignalDef } from '../types';

/** Whether any of the logs has the data the signal needs. */
export function viewerSignalAvailable(def: ViewerSignalDef, entries: readonly LogEntry[]): boolean {
  const needs = def.needs;
  if (!needs) return true;

  return entries.some((e) => e.log.presence[needs]);
}
