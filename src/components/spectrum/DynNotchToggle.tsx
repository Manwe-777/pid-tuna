import { DYN_NOTCH_COLOR } from '../../constants';

/** Shows or hides the dynamic-notch markers, with their median frequencies. */
export function DynNotchToggle({
  dynNotchHz,
  checked,
  onChange,
}: {
  dynNotchHz: number[];
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className="rpm-markers">
      <label className={`rpm-motor${checked ? ' rpm-motor--on' : ''}`}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="signal-chip__swatch" style={{ background: DYN_NOTCH_COLOR }} />
        Dynamic notches
      </label>
      <span className="muted">
        median {dynNotchHz.map((hz) => `${hz.toFixed(0)} Hz`).join(' · ')} (from FFT_FREQ debug)
      </span>
    </div>
  );
}
