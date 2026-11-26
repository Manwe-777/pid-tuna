import { useRef } from 'react';

/** A grab strip on one edge of the plot selection; reports the pointer's X while dragged. */
export function PlotSelectionEdge({ left, onDrag }: { left: number; onDrag: (clientX: number) => void }) {
  const dragging = useRef(false);

  const stop = () => {
    dragging.current = false;
  };

  return (
    <span
      className="plot-selection__edge"
      style={{ left }}
      data-tip="Drag to adjust"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging.current = true;
      }}
      onPointerMove={(e) => {
        if (dragging.current) onDrag(e.clientX);
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
    />
  );
}
