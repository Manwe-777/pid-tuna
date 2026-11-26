import { viridis } from '../utils/viridis';

/** Viridis colour for a dB value between floor (dark) and floor + range (bright), clamped. */
export function dbColor(db: number, floorDb: number, range: number): readonly [number, number, number] {
  return viridis(Math.max(0, Math.min(1, (db - floorDb) / range)));
}
