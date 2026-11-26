import type uPlot from 'uplot';

/** Sets one scale to the pinned bounds, keeping the current (auto-fit) value on an unpinned side. */
function pinScale(u: uPlot, key: 'x' | 'y', min: number | undefined, max: number | undefined) {
  if (min == null && max == null) return;
  const s = u.scales[key];
  u.setScale(key, { min: min ?? s?.min ?? 0, max: max ?? s?.max ?? 0 });
}

/**
 * Push the caller's pinned bounds onto the plot. Where a side is unspecified,
 * use the current scale value (which uPlot has already auto-fit to data). This
 * is used for both initial display and dblclick-reset.
 */
export function applyPinned(
  u: uPlot,
  xMin: number | undefined,
  xMax: number | undefined,
  yMin: number | undefined,
  yMax: number | undefined,
) {
  pinScale(u, 'x', xMin, xMax);
  pinScale(u, 'y', yMin, yMax);
}
