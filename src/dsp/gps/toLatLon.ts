import { M_PER_DEG_LAT } from '../../constants';
import type { V2 } from '../../types';

export function toLatLon(p: V2, centerLat: number, centerLon: number, mPerDegLon: number): [number, number] {
  return [p.y / M_PER_DEG_LAT + centerLat, p.x / mPerDegLon + centerLon];
}
