export function Field({
  label,
  unit,
  value,
  step = 1,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => {
          const v = Number.parseFloat(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        style={{ width: '4.5rem' }}
      />
      <span className="muted">{unit}</span>
    </label>
  );
}
