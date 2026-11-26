export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;

  return s.length % 2 ? s[m]! : 0.5 * (s[m - 1]! + s[m]!);
}
