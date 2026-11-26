import { median } from '../../utils/median';

/** Keep windows inside the settle band and within k robust deviations of the median level. */
export function screenLevels(levels: number[], settleMin: number, settleMax: number, k: number): boolean[] {
  const inBand = levels.map((l) => Number.isFinite(l) && l >= settleMin && l <= settleMax);
  const banded = levels.filter((_l, i) => inBand[i]);
  if (banded.length < 3) return inBand;

  const center = median(banded);
  const spread = 1.4826 * median(banded.map((l) => Math.abs(l - center)));
  if (!(spread > 0)) return inBand;

  return levels.map((l, i) => inBand[i]! && Math.abs(l - center) <= k * spread);
}
