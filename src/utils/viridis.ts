import { VIRIDIS } from '../constants';

/** Viridis colour for t in [0, 1] (clamped), as RGB 0–255. */
export function viridis(t: number): readonly [number, number, number] {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  const segs = VIRIDIS.length - 1;
  const pos = c * segs;
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, segs);
  const frac = pos - lo;
  const a = VIRIDIS[lo]!;
  const b = VIRIDIS[hi]!;
  return [
    Math.round(a[0] + (b[0] - a[0]) * frac),
    Math.round(a[1] + (b[1] - a[1]) * frac),
    Math.round(a[2] + (b[2] - a[2]) * frac),
  ];
}
