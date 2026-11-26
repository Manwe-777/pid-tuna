import type { GpsTrackOverlay } from '../../types';
import { denseLonLatChord } from './denseLonLatChord';
import { gpsCoordValid } from './gpsCoordValid';
import { gpsDisplayProjection } from './gpsDisplayProjection';
import { gpsViridisColor } from './gpsViridisColor';

/** First (or, with `fromEnd`, last) fix with valid coordinates. */
function validEnd(lat: Float32Array, lon: Float32Array, fromEnd: boolean): [number, number] | null {
  for (let k = 0; k < lat.length; k++) {
    const i = fromEnd ? lat.length - 1 - k : k;
    if (gpsCoordValid(lat[i]!, lon[i]!)) return [lat[i]!, lon[i]!];
  }

  return null;
}

/** Altitude range over valid fixes, or null when there's no spread to colour by. */
function altitudeRange(lat: Float32Array, lon: Float32Array, altitude: Float32Array | undefined) {
  if (!altitude) return null;
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < lat.length; i++) {
    const v = altitude[i]!;
    if (!gpsCoordValid(lat[i]!, lon[i]!) || !Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }

  return Number.isFinite(min) && max !== -Infinity && max > min ? { min, max } : null;
}

/**
 * The GPS map's drawing: one segment per pair of valid fixes (densified along
 * the display projection when there is one), coloured by mean altitude when the
 * altitude varies, plus the start and end fixes.
 */
export function gpsTrackOverlay(
  lat: Float32Array,
  lon: Float32Array,
  altitude: Float32Array | undefined,
  stroke: string,
  chordSteps: number,
): GpsTrackOverlay {
  const startMark = validEnd(lat, lon, false);
  const legend = altitudeRange(lat, lon, altitude);
  const proj = gpsDisplayProjection(lat, lon);
  const segments: GpsTrackOverlay['segments'] = [];
  const boundsPoints: [number, number][] = [];

  for (let i = 1; i < lat.length; i++) {
    if (!gpsCoordValid(lat[i - 1]!, lon[i - 1]!) || !gpsCoordValid(lat[i]!, lon[i]!)) continue;

    const positions: [number, number][] =
      proj != null
        ? denseLonLatChord(lat, lon, i - 1, i, proj.centerLat, proj.centerLon, proj.mPerDegLon, chordSteps)
        : [
            [lat[i - 1]!, lon[i - 1]!],
            [lat[i]!, lon[i]!],
          ];
    for (const pt of positions) boundsPoints.push(pt);

    const color =
      legend && altitude
        ? gpsViridisColor((altitude[i - 1]! + altitude[i]!) / 2, legend.min, legend.max, stroke)
        : stroke;
    segments.push({ positions, color });
  }

  return {
    segments,
    boundsPoints,
    startMark,
    endMark: validEnd(lat, lon, true),
    center: startMark ?? [0, 0],
    legend,
  };
}
