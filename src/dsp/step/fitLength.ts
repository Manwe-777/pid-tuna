export function fitLength(trace: Float32Array, len: number): Float32Array {
  if (trace.length === len) return trace;

  const out = new Float32Array(len);
  out.set(trace.subarray(0, len));
  for (let i = trace.length; i < len; i++) out[i] = trace[trace.length - 1]!;

  return out;
}
