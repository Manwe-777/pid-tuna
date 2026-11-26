/** Each window's mean is removed so a constant offset doesn't leak into the lowest bins. */
export function segmentMean(signal: Float32Array, start: number, len: number): number {
  let s = 0;
  for (let i = 0; i < len; i++) s += signal[start + i]!;

  return s / len;
}
