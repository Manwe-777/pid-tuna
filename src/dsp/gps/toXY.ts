import { M_PER_DEG_LAT } from '../../constants';
import type { V2 } from '../../types';

export function toXY(lat: number, lon: number, centerLat: number, centerLon: number, mPerDegLon: number): V2 {
  return {
    x: (lon - centerLon) * mPerDegLon,
    y: (lat - centerLat) * M_PER_DEG_LAT,
  };
}
