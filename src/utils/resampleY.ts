/** Linear-interpolation resample of `(srcX, srcY)` onto `targetX`. */
export function resampleY(srcX: Float32Array, srcY: Float32Array, targetX: Float32Array): Float32Array {
  const out = new Float32Array(targetX.length);
  if (srcX.length < 2) {
    out.fill(srcY[0] ?? 0);
    return out;
  }
  let si = 0;
  for (let ti = 0; ti < targetX.length; ti++) {
    const t = targetX[ti]!;
    while (si < srcX.length - 1 && srcX[si + 1]! < t) si++;
    if (si >= srcX.length - 1) {
      out[ti] = srcY[srcX.length - 1]!;
    } else {
      const x0 = srcX[si]!;
      const x1 = srcX[si + 1]!;
      const denom = x1 - x0;
      const frac = denom === 0 ? 0 : (t - x0) / denom;
      out[ti] = srcY[si]! + frac * (srcY[si + 1]! - srcY[si]!);
    }
  }
  return out;
}
