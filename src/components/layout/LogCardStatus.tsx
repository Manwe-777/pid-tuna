import type { SlotState } from '../../types';

/** Parse progress while loading, or the parse error. */
export function LogCardStatus({ state }: { state: SlotState }) {
  if (state.kind === 'parsing') {
    return (
      <div className="log-card__status muted">
        Parsing — {(state.progress * 100).toFixed(0)}% ({state.rows.toLocaleString()} rows)
      </div>
    );
  }

  return state.kind === 'error' ? <div className="log-card__error">{state.message}</div> : null;
}
