export function FilterLine({
  label,
  hz,
  type,
  cutoff,
  dyn,
}: {
  label: string;
  hz?: number;
  type?: string;
  cutoff?: number;
  dyn?: { min: number; max: number };
}) {
  if (hz == null || hz === 0) {
    return (
      <li>
        <span className="tune-list__k">{label}</span>
        <span className="tune-list__v muted">off</span>
      </li>
    );
  }
  let value = `${hz} Hz`;
  if (cutoff != null && cutoff !== 0) value += ` (cutoff ${cutoff} Hz)`;
  if (dyn && dyn.min !== dyn.max && dyn.min > 0) value = `${dyn.min}–${dyn.max} Hz (dynamic)`;
  if (type) value += ` · ${type}`;
  return (
    <li>
      <span className="tune-list__k">{label}</span>
      <span className="tune-list__v">{value}</span>
    </li>
  );
}
