import type { DragEvent } from 'react';

interface DragCallbacks {
  onDragStart?: () => void;
  onDragEnter?: () => void;
  onDragEnd?: () => void;
  onDrop?: () => void;
}

/** Native drag-and-drop handlers for reordering a card; inert unless `draggable`. */
export function cardDragHandlers(id: string, draggable: boolean, cb: DragCallbacks) {
  return {
    onDragStart: (e: DragEvent) => {
      if (!draggable) return;
      e.dataTransfer.effectAllowed = 'move';
      // Required by Firefox to start the drag.
      e.dataTransfer.setData('text/plain', id);
      cb.onDragStart?.();
    },
    onDragOver: (e: DragEvent) => {
      if (!draggable) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    },
    onDragEnter: (e: DragEvent) => {
      if (!draggable) return;
      e.preventDefault();
      cb.onDragEnter?.();
    },
    onDragEnd: () => cb.onDragEnd?.(),
    onDrop: (e: DragEvent) => {
      if (!draggable) return;
      e.preventDefault();
      cb.onDrop?.();
    },
  };
}
