import { useMemo, useRef, useState } from 'react';
import { AXIS_COLORS, AXIS_NAMES } from '../axes';
import type { LogSlot } from '../logs';
import { DASH_PATTERNS, LOG_COLORS } from '../logs';
import { buildTuneView } from '../tuneView';

export interface SidebarProps {
  slots: LogSlot[];
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
        <button
          type="button"
          className="sidebar__add"
          onClick={() => inputRef.current?.click()}
        >
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
            No logs loaded yet. Click <strong>+ Add log</strong> or drag a <code>.bbl</code>/<code>.bfl</code> file here.
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

function LogCard({
  slot,
  onToggle,
  onRemove,
  draggable = false,
  dragging = false,
  dropTarget = false,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDrop,
}: {
  slot: LogSlot;
  onToggle: () => void;
  onRemove: () => void;
  draggable?: boolean;
  dragging?: boolean;
  dropTarget?: boolean;
  onDragStart?: () => void;
  onDragEnter?: () => void;
  onDragEnd?: () => void;
  onDrop?: () => void;
}) {
  const view = useMemo(
    () => (slot.state.kind === 'ready' ? buildTuneView(slot.state.log) : null),
    [slot.state],
  );

  const className = [
    'log-card',
    slot.enabled ? '' : 'log-card--off',
    dragging ? 'log-card--dragging' : '',
    dropTarget ? 'log-card--drop-target' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={className}
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return;
        e.dataTransfer.effectAllowed = 'move';
        // Required by Firefox to start the drag.
        e.dataTransfer.setData('text/plain', slot.id);
        onDragStart?.();
      }}
      onDragOver={(e) => {
        if (!draggable) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDragEnter={(e) => {
        if (!draggable) return;
        e.preventDefault();
        onDragEnter?.();
      }}
      onDragEnd={() => onDragEnd?.()}
      onDrop={(e) => {
        if (!draggable) return;
        e.preventDefault();
        onDrop?.();
      }}
    >
      <div className="log-card__top">
        {draggable && (
          <span className="log-card__grip" title="Drag to reorder" aria-hidden>
            ⋮⋮
          </span>
        )}
        <input
          type="checkbox"
          checked={slot.enabled}
          onChange={onToggle}
          disabled={slot.state.kind !== 'ready'}
          title={slot.enabled ? 'Plotted' : 'Hidden'}
        />
        <DashSwatch dashIndex={slot.dashIndex} />
        <span className="log-card__name">
          {slot.state.kind === 'parsing' ? slot.state.fileName
            : slot.state.kind === 'ready' ? slot.state.log.fileName
            : slot.state.fileName}
        </span>
        <button type="button" className="log-card__remove" onClick={onRemove} title="Remove">
          ✕
        </button>
      </div>
      {slot.state.kind === 'parsing' && (
        <div className="log-card__status muted">
          Parsing — {(slot.state.progress * 100).toFixed(0)}% ({slot.state.rows.toLocaleString()} rows)
        </div>
      )}
      {slot.state.kind === 'error' && (
        <div className="log-card__error">{slot.state.message}</div>
      )}
      {view && (
        <div className="log-card__pid" title="P · I · D · D-max · F">
          {AXIS_NAMES.map((name, i) => {
            const row = view.pidByAxis[i]!;
            return (
              <div key={name} className="log-card__pid-row">
                <span className="log-card__chip" style={{ background: AXIS_COLORS[i] }}>
                  {name.slice(0, 1)}
                </span>
                <span className="log-card__num">{fmt(row.p)}</span>
                <span className="log-card__num">{fmt(row.i)}</span>
                <span className="log-card__num">{fmt(row.d)}</span>
                <span className="log-card__num log-card__num--sub">{fmt(row.dMax)}</span>
                <span className="log-card__num log-card__num--sub">{fmt(row.f)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DashSwatch({ dashIndex }: { dashIndex: number }) {
  const pattern = DASH_PATTERNS[dashIndex % DASH_PATTERNS.length] ?? [];
  const dashAttr = pattern.length > 0 ? pattern.join(' ') : 'none';
  const color = LOG_COLORS[dashIndex % LOG_COLORS.length]!;
  return (
    <svg width="22" height="6" className="log-card__dash" aria-hidden>
      <line
        x1="1"
        y1="3"
        x2="21"
        y2="3"
        stroke={color}
        strokeWidth="2"
        strokeDasharray={dashAttr}
      />
    </svg>
  );
}

function fmt(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toString();
}
