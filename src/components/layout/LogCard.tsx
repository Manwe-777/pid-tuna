import { useMemo } from 'react';
import { AXIS_COLORS, AXIS_NAMES } from '../../constants';
import { buildTuneView } from '../../tune/buildTuneView';
import type { LogSlot } from '../../types';
import { formatGain } from '../../utils/formatGain';
import { DashSwatch } from './DashSwatch';

export function LogCard({
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
  const view = useMemo(() => (slot.state.kind === 'ready' ? buildTuneView(slot.state.log) : null), [slot.state]);

  const className = [
    'log-card',
    slot.enabled ? '' : 'log-card--off',
    dragging ? 'log-card--dragging' : '',
    dropTarget ? 'log-card--drop-target' : '',
  ]
    .filter(Boolean)
    .join(' ');

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
          {slot.state.kind === 'parsing'
            ? slot.state.fileName
            : slot.state.kind === 'ready'
              ? slot.state.log.fileName
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
      {slot.state.kind === 'error' && <div className="log-card__error">{slot.state.message}</div>}
      {view && (
        <div className="log-card__pid" title="P · I · D · D-max · F">
          {AXIS_NAMES.map((name, i) => {
            const row = view.pidByAxis[i]!;
            return (
              <div key={name} className="log-card__pid-row">
                <span className="log-card__chip" style={{ background: AXIS_COLORS[i] }}>
                  {name.slice(0, 1)}
                </span>
                <span className="log-card__num">{formatGain(row.p)}</span>
                <span className="log-card__num">{formatGain(row.i)}</span>
                <span className="log-card__num">{formatGain(row.d)}</span>
                <span className="log-card__num log-card__num--sub">{formatGain(row.dMax)}</span>
                <span className="log-card__num log-card__num--sub">{formatGain(row.f)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
