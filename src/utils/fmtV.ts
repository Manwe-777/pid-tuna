export function fmtV(v: number | null): string {
  return v == null ? '—' : `${v.toFixed(2)} V`;
}
