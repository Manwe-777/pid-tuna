/**
 * `values` at `length` samples for plotting against a longer time axis: cut when longer,
 * and NaN past its end when shorter, so the line stops where the data does.
 */
export function padWithGap(values: Float32Array, length: number): Float32Array {
  if (values.length === length) return values;
  const out = new Float32Array(length).fill(Number.NaN);
  out.set(values.subarray(0, Math.min(values.length, length)));

  return out;
}
