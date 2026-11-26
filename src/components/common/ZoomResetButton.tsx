import { useSyncExternalStore } from 'react';

import type { ZoomGroup } from '../../plot/ZoomGroup';

/** Shown in a plot's top-right corner while it is zoomed in; zooms back out. */
export function ZoomResetButton({ group, onReset }: { group: ZoomGroup; onReset: () => void }) {
  const range = useSyncExternalStore(group.subscribe, () => group.range);
  if (!range) return null;

  return (
    <button
      type="button"
      className="plot-zoom-reset"
      data-tip="Zoomed in. Show the whole range (or double-click the plot)"
      onClick={onReset}
    >
      <span aria-hidden="true">⤢</span>
      Reset zoom
    </button>
  );
}
