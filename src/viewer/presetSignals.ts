import { VIEWER_SIGNALS } from '../constants';
import type { LogEntry, ViewerPreset, ViewerSignalKey } from '../types';
import { viewerSignalAvailable } from './viewerSignalAvailable';

/** The preset's signals that the logs have. */
export function presetSignals(preset: ViewerPreset, entries: readonly LogEntry[]): Set<ViewerSignalKey> {
  const keys = VIEWER_SIGNALS.filter((d) => preset.signals.includes(d.key) && viewerSignalAvailable(d, entries));

  return new Set(keys.map((d) => d.key));
}
