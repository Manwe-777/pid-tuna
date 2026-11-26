import { useEffect, useState } from 'react';

import { VIEWER_STORAGE_KEY } from '../constants';
import type { ViewerSelection, ViewerSignalKey } from '../types';
import { toggleInSet } from '../utils/toggleInSet';
import { parseViewerSelection } from '../viewer/parseViewerSelection';
import { serializeViewerSelection } from '../viewer/serializeViewerSelection';

function readStored(): ViewerSelection {
  try {
    return parseViewerSelection(localStorage.getItem(VIEWER_STORAGE_KEY));
  } catch {
    return parseViewerSelection(null);
  }
}

/** The log viewer's signals, axes and hidden motors, remembered across tab switches and reloads. */
export function useViewerSelection() {
  const [selection, setSelection] = useState<ViewerSelection>(readStored);

  useEffect(() => {
    try {
      localStorage.setItem(VIEWER_STORAGE_KEY, serializeViewerSelection(selection));
    } catch {
      // Storage blocked: the selection just isn't remembered.
    }
  }, [selection]);

  return {
    selection,
    setSignals: (signals: ReadonlySet<ViewerSignalKey>) => setSelection((s) => ({ ...s, signals })),
    toggleSignal: (key: ViewerSignalKey) => setSelection((s) => ({ ...s, signals: toggleInSet(s.signals, key) })),
    toggleAxis: (axis: number) => setSelection((s) => ({ ...s, axes: toggleInSet(s.axes, axis) })),
    toggleMotor: (motor: number) => setSelection((s) => ({ ...s, hiddenMotors: toggleInSet(s.hiddenMotors, motor) })),
  };
}
