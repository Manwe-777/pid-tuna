import type uPlot from 'uplot';

/** Zooms the X scale back out to the pinned bounds, or to the data where a side has none. */
export function resetXScale(u: uPlot, xMin: number | undefined, xMax: number | undefined): void {
  const xd = u.data[0];
  if (!xd?.length) return;
  u.setScale('x', { min: xMin ?? xd[0]!, max: xMax ?? xd[xd.length - 1]! });
}
