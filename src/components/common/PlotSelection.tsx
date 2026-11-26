import { useEffect, useRef, useSyncExternalStore } from 'react';

import { moveSpanEdge } from '../../plot/moveSpanEdge';
import type { ZoomGroup } from '../../plot/ZoomGroup';
import type { PlotArea } from '../../types';
import { PlotSelectionEdge } from './PlotSelectionEdge';

/**
 * The dragged-out selection over a plot, with edges that can be dragged to adjust it.
 * `area` is the plot area in CSS px relative to uPlot's `over` element, which this is portalled into.
 */
export function PlotSelection({ group, area }: { group: ZoomGroup; area: PlotArea }) {
  const span = useSyncExternalStore(group.subscribe, () => group.selection);
  const layerRef = useRef<HTMLDivElement>(null);
  const shown = span != null;

  // uPlot listens for mousedown on its `over` element, which sees native events before
  // React's handlers run; stop them here so grabbing an edge doesn't start a new selection.
  useEffect(() => {
    const layer = layerRef.current;
    const stop = (e: MouseEvent) => e.stopPropagation();
    layer?.addEventListener('mousedown', stop);

    return () => layer?.removeEventListener('mousedown', stop);
  }, [shown]);

  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && group.select(null);
    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [group, shown]);

  if (!span || area.xMax <= area.xMin) return null;
  const toPx = (v: number) => ((v - area.xMin) / (area.xMax - area.xMin)) * area.width;
  const left = Math.max(0, toPx(span.min));
  const right = Math.min(area.width, toPx(span.max));
  if (right <= 0 || left >= area.width) return null;

  const dragEdge = (edge: 'min' | 'max') => (clientX: number) => {
    const current = group.selection;
    const rect = layerRef.current?.getBoundingClientRect();
    if (!current || !rect) return;
    const value = area.xMin + ((clientX - rect.left) / rect.width) * (area.xMax - area.xMin);
    group.select(moveSpanEdge(current, edge, value, { min: area.xMin, max: area.xMax }));
  };

  return (
    <div ref={layerRef} className="plot-selection-layer" style={{ top: area.top, height: area.height }}>
      <div className="plot-selection" style={{ left, width: right - left }} />
      <PlotSelectionEdge left={left} onDrag={dragEdge('min')} />
      <PlotSelectionEdge left={right} onDrag={dragEdge('max')} />
      <span className="plot-selection__label" style={{ left: (left + right) / 2 }}>
        {span.min.toFixed(2)}–{span.max.toFixed(2)} s
        <button
          type="button"
          className="plot-selection__clear"
          aria-label="Clear selection"
          data-tip="Clear selection (Esc)"
          onClick={() => group.select(null)}
        >
          ×
        </button>
      </span>
    </div>
  );
}
