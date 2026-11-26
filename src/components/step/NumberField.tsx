export function NumberField({
  label,
  unit,
  value,
  min,
  max,
  step,
  title,
  placeholder,
  onChange,
}: {
  label: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  title?: string;
  placeholder?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label title={title}>
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
