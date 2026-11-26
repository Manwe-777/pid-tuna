import { M_PER_DEG_LAT } from '../../constants';
import { gpsCoordValid } from './gpsCoordValid';

/** Mean lat/lon of valid fixes — shared projection for spline densification + smoothing runs. */
export function gpsDisplayProjection(
  lat: Float32Array,
  lon: Float32Array,
): {
  centerLat: number;
  centerLon: number;
  mPerDegLon: number;
} | null {
  const n = lat.length;
  if (n === 0 || lon.length !== n) return null;
  let sLa = 0;
  let sLo = 0;
  let c = 0;

  for (let i = 0; i < n; i++) {
    if (!gpsCoordValid(lat[i]!, lon[i]!)) continue;
    sLa += lat[i]!;
    sLo += lon[i]!;
    c++;
  }

  if (c === 0) return null;
  const centerLat = sLa / c;
  const centerLon = sLo / c;
  return {
    centerLat,
    centerLon,
    mPerDegLon: M_PER_DEG_LAT * Math.cos((centerLat * Math.PI) / 180),
  };
}
