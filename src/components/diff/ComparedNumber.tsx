export function ComparedNumber({
  value,
  prev,
  unit,
  label,
  dim,
  decimals = 1,
}: {
  value: number | null;
  prev: number | null;
  unit: string;
  label?: string;
  dim?: boolean;
  decimals?: number;
}) {
  if (value == null) return <span className="muted">—</span>;
  const valueStr = `${value.toFixed(decimals)} ${unit}`;
  const cls = !dim && prev != null ? (value > prev ? 'diff-tok--up' : value < prev ? 'diff-tok--down' : '') : '';
  return (
    <span className="diff-metric">
      {label && <span className="diff-metric__label">{label}</span>}
      <span className={cls}>{valueStr}</span>
    </span>
  );
}
