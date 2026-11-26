import { useMemo } from 'react';

import { buildTuneView } from '../../tune/buildTuneView';
import type { LogSlot } from '../../types';
import { cardDragHandlers } from '../../utils/cardDragHandlers';
import { slotFileName } from '../../utils/slotFileName';
import { DashSwatch } from './DashSwatch';
import { LogCardPid } from './LogCardPid';
import { LogCardStatus } from './LogCardStatus';

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

  const dragHandlers = cardDragHandlers(slot.id, draggable, { onDragStart, onDragEnter, onDragEnd, onDrop });
  const className = [
    'log-card',
    slot.enabled ? '' : 'log-card--off',
    dragging ? 'log-card--dragging' : '',
    dropTarget ? 'log-card--drop-target' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className} draggable={draggable} {...dragHandlers}>
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
        <span className="log-card__name">{slotFileName(slot.state)}</span>
        <button type="button" className="log-card__remove" onClick={onRemove} title="Remove">
          ✕
        </button>
      </div>
      <LogCardStatus state={slot.state} />
      {view && <LogCardPid view={view} />}
    </div>
  );
}
