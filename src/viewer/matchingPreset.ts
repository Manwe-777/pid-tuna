import { VIEWER_PRESETS, VIEWER_SIGNALS } from '../constants';
import type { LogEntry, ViewerPresetId, ViewerSignalKey } from '../types';
import { presetSignals } from './presetSignals';
import { viewerSignalAvailable } from './viewerSignalAvailable';

/** The preset that shows exactly the selected signals (counting only signals the logs have), or null. */
export function matchingPreset(
  signals: ReadonlySet<ViewerSignalKey>,
  entries: readonly LogEntry[],
): ViewerPresetId | null {
  const shown = VIEWER_SIGNALS.filter((d) => signals.has(d.key) && viewerSignalAvailable(d, entries)).map((d) => d.key);
  if (shown.length === 0) return null;

  const match = VIEWER_PRESETS.find((p) => {
    const keys = presetSignals(p, entries);

    return keys.size === shown.length && shown.every((k) => keys.has(k));
  });

  return match?.id ?? null;
}
