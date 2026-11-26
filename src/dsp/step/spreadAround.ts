export function spreadAround(segments: Float32Array[], mean: Float32Array): Float32Array {
  const out = new Float32Array(mean.length);
  if (segments.length < 2) return out;

  for (const seg of segments) {
    for (let i = 0; i < mean.length; i++) {
      const d = seg[i]! - mean[i]!;
      out[i] = out[i]! + d * d;
    }
  }

  for (let i = 0; i < out.length; i++) out[i] = Math.sqrt(out[i]! / segments.length);

  return out;
}
