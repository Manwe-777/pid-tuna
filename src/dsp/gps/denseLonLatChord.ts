import type { V2 } from '../../types';
import { gpsCoordValid } from './gpsCoordValid';
import { toLatLon } from './toLatLon';
import { toXY } from './toXY';

/** Uniform Catmull–Rom between p1 and p2 (in meters). */
function catmullRom(p0: V2, p1: V2, p2: V2, p3: V2, t: number): V2 {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

function prevValidCoord(lat: Float32Array, lon: Float32Array, start: number): number {
  for (let k = start; k >= 0; k--) {
    if (gpsCoordValid(lat[k]!, lon[k]!)) return k;
  }

  return -1;
}

function nextValidCoord(lat: Float32Array, lon: Float32Array, start: number, n: number): number {
  for (let k = start; k < n; k++) {
    if (gpsCoordValid(lat[k]!, lon[k]!)) return k;
  }

  return -1;
}

/**
 * Curve along `[i1]`→`[i2]` (`i2` is usually `i1+1`) with Catmull–Rom tangents from neighbors.
 * When `steps <= 1`, returns the straight chord (only endpoints).
 */
export function denseLonLatChord(
  lat: Float32Array,
  lon: Float32Array,
  i1: number,
  i2: number,
  centerLat: number,
  centerLon: number,
  mPerDegLon: number,
  steps: number,
): [number, number][] {
  const A = lat[i1]!;
  const Ao = lon[i1]!;
  const B = lat[i2]!;
  const Bo = lon[i2]!;

  if (steps <= 1) {
    return [
      [A, Ao],
      [B, Bo],
    ];
  }

  const n = lat.length;
  const out: [number, number][] = [];
  const i0 = prevValidCoord(lat, lon, i1 - 1);
  const i3 = nextValidCoord(lat, lon, i2 + 1, n);

  const xy1 = toXY(A, Ao, centerLat, centerLon, mPerDegLon);
  const xy2 = toXY(B, Bo, centerLat, centerLon, mPerDegLon);

  let p0v: V2;
  let p3v: V2;

  if (i0 >= 0) {
    p0v = toXY(lat[i0]!, lon[i0]!, centerLat, centerLon, mPerDegLon);
  } else {
    p0v = { x: 2 * xy1.x - xy2.x, y: 2 * xy1.y - xy2.y };
  }

  if (i3 >= 0) {
    p3v = toXY(lat[i3]!, lon[i3]!, centerLat, centerLon, mPerDegLon);
  } else {
    p3v = { x: 2 * xy2.x - xy1.x, y: 2 * xy2.y - xy1.y };
  }

  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const p = catmullRom(p0v, xy1, xy2, p3v, t);
    out.push(toLatLon(p, centerLat, centerLon, mPerDegLon));
  }

  return out;
}
