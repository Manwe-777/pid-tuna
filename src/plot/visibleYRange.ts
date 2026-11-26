import type uPlot from 'uplot';

type Range = { lo: number; hi: number };

/** Widens `r` by the finite values of `ys` whose x lies in [xLo, xHi]. */
function extend(r: Range, xs: uPlot.AlignedData[number], ys: uPlot.AlignedData[number], xLo: number, xHi: number) {
  for (let i = 0; i < ys.length; i++) {
    const x = xs[i];
    const y = ys[i];
    if (x == null || x < xLo || x > xHi || y == null || !Number.isFinite(y)) continue;
    if (y < r.lo) r.lo = y;
    if (y > r.hi) r.hi = y;
  }
}

/** Min and max of every series' finite values whose x lies in [xLo, xHi], or null when there are none. */
export function visibleYRange(u: uPlot, xLo: number, xHi: number): Range | null {
  const r: Range = { lo: Infinity, hi: -Infinity };

  for (let s = 1; s < u.series.length; s++) {
    const ys = u.data[s];
    if (ys) extend(r, u.data[0], ys, xLo, xHi);
  }

  return r.lo === Infinity || r.hi === -Infinity ? null : r;
}
