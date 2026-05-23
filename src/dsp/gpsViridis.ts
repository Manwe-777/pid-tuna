import { gpsCoordValid } from './gpsPlayback';

/** Discrete viridis-ish stops aligned with leaflet track segments (GPS map + charts). */
export const GPS_VIRIDIS_STOPS = [
  '#440154', '#482878', '#3e4989', '#31688e', '#26828e',
  '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725',
] as const;

export function gpsViridisColor(c: number, cMin: number, cMax: number, fallback: string): string {
  if (!Number.isFinite(c) || cMax === -Infinity || !(cMax > cMin)) return fallback;
  const t = Math.max(0, Math.min(1, (c - cMin) / (cMax - cMin)));
  const idx = Math.min(GPS_VIRIDIS_STOPS.length - 1, Math.floor(t * GPS_VIRIDIS_STOPS.length));
  return GPS_VIRIDIS_STOPS[idx]!;
}

/**
 * Stroke color per segment alt[i..i+1], using the same valid-fix mask and altitude
 * range as the GPS map viridis coloring.
 */
export function gpsAltitudeViridisSegments(
  lat: Float32Array,
  lon: Float32Array,
  altitude: Float32Array,
  fallback: string,
): readonly string[] | undefined {
  if (altitude.length < 2 || lat.length !== altitude.length || lon.length !== altitude.length) {
    return undefined;
  }

  let cMin = Infinity;
  let cMax = -Infinity;
  for (let i = 0; i < lat.length; i++) {
    if (!gpsCoordValid(lat[i]!, lon[i]!)) continue;
    const v = altitude[i]!;
    if (!Number.isFinite(v)) continue;
    if (v < cMin) cMin = v;
    if (v > cMax) cMax = v;
  }
  const colorize = Number.isFinite(cMin) && cMax !== -Infinity && cMax > cMin;

  const out: string[] = new Array(Math.max(0, altitude.length - 1));
  for (let i = 0; i < out.length; i++) {
    const la0 = lat[i]!;
    const lo0 = lon[i]!;
    const la1 = lat[i + 1]!;
    const lo1 = lon[i + 1]!;
    const fix =
      gpsCoordValid(la0, lo0) && gpsCoordValid(la1, lo1);

    if (colorize && fix) {
      const av = (altitude[i]! + altitude[i + 1]!) / 2;
      out[i] = gpsViridisColor(av, cMin, cMax, fallback);
    } else {
      out[i] = fallback;
    }
  }

  return out;
}
