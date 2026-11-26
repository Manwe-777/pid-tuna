export function GpsStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="battery-stat">
      <span className="battery-stat__label">{label}</span>
      <span className="battery-stat__value">{value}</span>
    </div>
  );
}
