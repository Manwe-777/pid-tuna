/** True when both lists hold the same array instances in the same order. */
export function sameArrays(prev: readonly unknown[] | null, next: readonly unknown[]): boolean {
  if (!prev || prev.length !== next.length) return false;

  return next.every((v, i) => prev[i] === v);
}
