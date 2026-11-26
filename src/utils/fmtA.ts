export function fmtA(a: number | null): string {
  return a == null ? '—' : `${a.toFixed(1)} A`;
}
