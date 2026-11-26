import { MOTOR_COLORS } from '../../constants';

/** Radio chips choosing which motor to compare across logs. */
export function MotorPicker({
  count,
  selected,
  onSelect,
}: {
  count: number;
  selected: number;
  onSelect: (idx: number) => void;
}) {
  return (
    <div className="controls">
      <span className="muted">Motor:</span>
      {Array.from({ length: count }, (_, idx) => (
        <label key={idx} className={`signal-chip${selected === idx ? ' signal-chip--on' : ''}`}>
          <input type="radio" name="motor-pick" checked={selected === idx} onChange={() => onSelect(idx)} />
          <span className="signal-chip__swatch" style={{ background: MOTOR_COLORS[idx % MOTOR_COLORS.length] }} />M
          {idx + 1}
        </label>
      ))}
    </div>
  );
}
