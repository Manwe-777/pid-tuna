import { flooredDb } from './flooredDb';

/** Magnitude in dB relative to `peak`, floored at `floorDb`. Leaves `out` untouched when there is no peak. */
export function fillPeakRelativeDb(out: Float32Array, linear: Float32Array, peak: number, floorDb: number): void {
  if (!(peak > 0)) return;

  const invPeak = 1 / peak;
  for (let i = 0; i < linear.length; i++) out[i] = flooredDb(linear[i]! * invPeak, 20, floorDb);
}
