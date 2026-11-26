export function meanOf(x: Float32Array, from: number, to: number): number {
  let s = 0;
  for (let i = from; i < to; i++) s += x[i]!;

  return to > from ? s / (to - from) : Number.NaN;
}
