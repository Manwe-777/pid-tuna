export function meanAbs(x: Float32Array, start: number, len: number): number {
  let s = 0;
  for (let i = 0; i < len; i++) s += Math.abs(x[start + i]!);

  return s / len;
}
