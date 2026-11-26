export function Num({
  label,
  unit,
  value,
  min,
  max,
  step,
  title,
  onChange,
}: {
  label: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  title?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label title={title}>
      {label}:
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const v = Number.parseFloat(e.target.value);
          if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
        }}
        style={{ width: '4.5rem' }}
      />
      {unit && <span className="filter-row__unit">{unit}</span>}
    </label>
  );
}
