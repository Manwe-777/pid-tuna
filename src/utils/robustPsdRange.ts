/** Robust [floor, ceil] dB window for the PSD colour scale, shared across axes
 *  so their heatmaps are directly comparable. */
export function robustPsdRange(arrays: Float32Array[]): { floor: number; ceil: number } {
  const vals: number[] = [];

  for (const a of arrays) {
    for (let i = 0; i < a.length; i++) {
      const v = a[i]!;
      if (Number.isFinite(v) && v > -199) vals.push(v);
    }
  }

  if (vals.length === 0) return { floor: -80, ceil: 0 };
  vals.sort((x, y) => x - y);
  const pct = (p: number) => vals[Math.min(vals.length - 1, Math.floor(vals.length * p))]!;
  const ceil = Math.ceil(pct(0.995) / 5) * 5;
  const floor = Math.floor((ceil - 60) / 5) * 5;
  return { floor, ceil };
}
