export function NumberField({
  label,
  unit,
  value,
  min,
  max,
  step,
  tip,
  placeholder,
  onChange,
}: {
  label: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  tip?: string;
  placeholder?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label data-tip={tip}>
      {label}
      <input
        type="number"
        className="step-controls__number"
        value={placeholder && value === 0 ? '' : value}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = Number.parseFloat(e.target.value);
          onChange(Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : 0);
        }}
      />
      {unit && <span className="muted">{unit}</span>}
    </label>
  );
}
