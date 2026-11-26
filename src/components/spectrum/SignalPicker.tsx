import { SIGNAL_DEFS } from '../../constants';
import type { SignalKey } from '../../types';

interface Props {
  /** With several logs only one signal can be picked (radio buttons). */
  multi: boolean;
  isChecked: (key: SignalKey) => boolean;
  available: Record<SignalKey, boolean>;
  onPick: (key: SignalKey) => void;
}

/** Signal chips: checkboxes for one log, radio buttons when comparing logs. */
export function SignalPicker({ multi, isChecked, available, onPick }: Props) {
  return (
    <>
      <div className="signal-grid">
        {SIGNAL_DEFS.map((def) => {
          const present = available[def.key];
          const checked = isChecked(def.key);

          return (
            <label
              key={def.key}
              className={`signal-chip${checked ? ' signal-chip--on' : ''}${present ? '' : ' signal-chip--off'}`}
            >
              <input
                type={multi ? 'radio' : 'checkbox'}
                name={multi ? 'fs-signal' : undefined}
                checked={checked}
                disabled={!present}
                onChange={() => onPick(def.key)}
              />
              <span className="signal-chip__swatch" style={{ background: def.color || '#888' }} />
              {def.label}
              {!present && <span className="signal-chip__note">(not logged)</span>}
            </label>
          );
        })}
      </div>
      {multi && (
        <p className="muted" style={{ marginTop: '-0.25rem', fontSize: '0.82rem' }}>
          Multi-log mode: pick one signal — each log will be drawn in its sidebar color.
        </p>
      )}
    </>
  );
}
