/** Resize `values` to match `length` by trimming or repeating the last value. */
export function align(values: Float32Array, length: number): Float32Array {
  if (values.length === length) return values;
  const out = new Float32Array(length);
  const n = Math.min(values.length, length);
  for (let i = 0; i < n; i++) out[i] = values[i]!;
  const fill = n > 0 ? values[n - 1]! : 0;
  for (let i = n; i < length; i++) out[i] = fill;
  return out;
}
