import { VIEWER_SIGNALS } from '../constants';
import type { ViewerSelection, ViewerSignalKey } from '../types';
import { defaultViewerSelection } from './defaultViewerSelection';

const KEYS = new Set<string>(VIEWER_SIGNALS.map((d) => d.key));

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function indices(value: unknown, max: number): Set<number> {
  return new Set(
    list(value).filter((v): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < max),
  );
}

/** A saved viewer selection, keeping only known signals and valid indices; the default when missing or corrupt. */
export function parseViewerSelection(raw: string | null): ViewerSelection {
  if (!raw) return defaultViewerSelection();

  try {
    const data = JSON.parse(raw) as Record<string, unknown> | null;
    if (typeof data !== 'object' || data === null) return defaultViewerSelection();
    const signals = new Set(list(data.signals).filter((k): k is ViewerSignalKey => KEYS.has(k as string)));

    return { signals, axes: indices(data.axes, 3), hiddenMotors: indices(data.hiddenMotors, 8) };
  } catch {
    return defaultViewerSelection();
  }
}
