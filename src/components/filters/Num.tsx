import { SLIDER_STEPS } from '../../constants';
import { useNumberDraft } from '../../hooks/useNumberDraft';
import { sliderPosition } from '../../utils/sliderPosition';
import { sliderValue } from '../../utils/sliderValue';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * A filter setting: a number box, with a slider in front when `slider` is set. Typing takes
 * effect once the number is within range; leaving the box clamps whatever is there.
 */
export function Num({
  label,
  unit,
  value,
  min,
  max,
  step,
  tip,
  slider = false,
  onChange,
}: {
  label: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  tip?: string;
  slider?: boolean;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useNumberDraft(value, String);

  const commit = (raw: string) => {
    const v = Number.parseFloat(raw);
    if (!Number.isFinite(v)) return setText(String(value));
    const next = clamp(v, min, max);
    setText(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <span className="filter-field" role="group" aria-label={label} data-tip={tip}>
      {label}:
      {slider && (
        <input
          type="range"
          className="filter-field__slider"
          aria-label={`${label} slider`}
          min={0}
          max={SLIDER_STEPS}
          step={1}
          value={sliderPosition(value, min, max)}
          onChange={(e) => onChange(sliderValue(Number(e.target.value), min, max, step))}
        />
      )}
      <input
        className="w-18"
        type="number"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const v = Number.parseFloat(e.target.value);
          if (Number.isFinite(v) && v >= min && v <= max) onChange(v);
        }}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && commit(e.currentTarget.value)}
      />
      {unit && <span className="filter-row__unit">{unit}</span>}
    </span>
  );
}
