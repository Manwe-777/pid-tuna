export function formatGain(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toString();
}
