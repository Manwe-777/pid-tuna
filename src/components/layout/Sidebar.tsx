import { useRef, useState } from 'react';
import type { LogSlot } from '../../types';
import { LogCard } from './LogCard';

interface SidebarProps {
  slots: readonly LogSlot[];
  onAddFile: (file: File) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onReorder?: (fromId: string, toId: string) => void;
}

export function Sidebar({ slots, onAddFile, onToggle, onRemove, onReorder }: SidebarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <span className="sidebar__title">Logs</span>
        <button type="button" className="sidebar__add" onClick={() => inputRef.current?.click()}>
          + Add log
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".bbl,.bfl,.BBL,.BFL,.csv"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onAddFile(file);
            e.target.value = ''; // allow re-picking the same file
          }}
        />
      </div>
      <div className="sidebar__body">
        {slots.length === 0 && (
          <div className="sidebar__empty">
            No logs loaded yet. Click <strong>+ Add log</strong> or drag a <code>.bbl</code>/<code>.bfl</code> file
            here.
          </div>
        )}
        {slots.map((slot) => (
          <LogCard
            key={slot.id}
            slot={slot}
            onToggle={() => onToggle(slot.id)}
            onRemove={() => onRemove(slot.id)}
            draggable={!!onReorder && slots.length > 1}
            dragging={dragId === slot.id}
            dropTarget={dropTargetId === slot.id && dragId !== null && dragId !== slot.id}
            onDragStart={() => setDragId(slot.id)}
            onDragEnter={() => {
              if (dragId && dragId !== slot.id) setDropTargetId(slot.id);
            }}
            onDragEnd={() => {
              setDragId(null);
              setDropTargetId(null);
            }}
            onDrop={() => {
              if (dragId && dragId !== slot.id) onReorder?.(dragId, slot.id);
              setDragId(null);
              setDropTargetId(null);
            }}
          />
        ))}
      </div>
    </aside>
  );
}
