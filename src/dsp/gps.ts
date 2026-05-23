import type { GpsFrameSeries } from '../types';

export interface GpsAnalysis {
  hasFix: boolean;
  /** Center of the flight's bounding box (degrees). */
  centerLat: number;
  centerLon: number;
  /** Track points projected to meters relative to centerLat/Lon (equirectangular). */
  xMeters: Float32Array;
  yMeters: Float32Array;
  /** Aligned with the original time array. */
  time: Float32Array;
  /** Total distance flown in meters. */
  totalDistanceM: number;
  /** Max altitude in meters across the window. */
  maxAltitudeM: number | null;
  /** Min altitude in meters. */
  minAltitudeM: number | null;
  /** Max speed in m/s. */
  maxSpeedMs: number | null;
  /** Mean speed in m/s. */
  meanSpeedMs: number | null;
  /** Min satellite count. */
  minSats: number | null;
}

const M_PER_DEG_LAT = 111320;

/**
 * Project GPS lat/lon to a flat (x, y) meters frame centered on the flight,
 * plus a few summary stats. Equirectangular projection is fine for the
 * few-km scales typical of FPV flights.
 *
 * Returns an empty/zero analysis when no GPS frames are present.
 */
export function analyzeGps(gps: GpsFrameSeries): GpsAnalysis {
  const n = gps.time.length;
  if (n === 0) return emptyAnalysis();

  // Filter to valid points (non-zero coords; some firmwares emit (0,0) before fix).
  let latSum = 0;
  let latCount = 0;
  let lonSum = 0;
  for (let i = 0; i < n; i++) {
    const la = gps.lat[i]!;
    const lo = gps.lon[i]!;
    if (!Number.isFinite(la) || !Number.isFinite(lo)) continue;
    if (la === 0 && lo === 0) continue;
    latSum += la;
    lonSum += lo;
    latCount++;
  }
  if (latCount === 0) return emptyAnalysis();

  const centerLat = latSum / latCount;
  const centerLon = lonSum / latCount;
  const mPerDegLon = M_PER_DEG_LAT * Math.cos((centerLat * Math.PI) / 180);

  const xMeters = new Float32Array(n);
  const yMeters = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const la = gps.lat[i]!;
    const lo = gps.lon[i]!;
    if (Number.isFinite(la) && Number.isFinite(lo) && !(la === 0 && lo === 0)) {
      xMeters[i] = (lo - centerLon) * mPerDegLon;
      yMeters[i] = (la - centerLat) * M_PER_DEG_LAT;
    } else {
      xMeters[i] = NaN;
      yMeters[i] = NaN;
    }
  }

  // Total distance: sum of segment lengths skipping NaN segments.
  let totalDistanceM = 0;
  for (let i = 1; i < n; i++) {
    const dx = xMeters[i]! - xMeters[i - 1]!;
    const dy = yMeters[i]! - yMeters[i - 1]!;
    if (Number.isFinite(dx) && Number.isFinite(dy)) {
      const d = Math.hypot(dx, dy);
      if (d < 5000 /* clamp impossible jumps */) totalDistanceM += d;
    }
  }

  let maxAlt = -Infinity;
  let minAlt = Infinity;
  let maxSpd = -Infinity;
  let spdSum = 0;
  let spdN = 0;
  let minSats = Infinity;
  for (let i = 0; i < n; i++) {
    const a = gps.altitude[i]!;
    if (Number.isFinite(a)) {
      if (a > maxAlt) maxAlt = a;
      if (a < minAlt) minAlt = a;
    }
    const s = gps.speed[i]!;
    if (Number.isFinite(s)) {
      if (s > maxSpd) maxSpd = s;
      spdSum += s;
      spdN++;
    }
    const ns = gps.numSat[i]!;
    if (Number.isFinite(ns) && ns < minSats) minSats = ns;
  }

  return {
    hasFix: true,
    centerLat,
    centerLon,
    xMeters,
    yMeters,
    time: gps.time,
    totalDistanceM,
    maxAltitudeM: maxAlt === -Infinity ? null : maxAlt,
    minAltitudeM: minAlt === Infinity ? null : minAlt,
    maxSpeedMs: maxSpd === -Infinity ? null : maxSpd,
    meanSpeedMs: spdN > 0 ? spdSum / spdN : null,
    minSats: minSats === Infinity ? null : minSats,
  };
}

function emptyAnalysis(): GpsAnalysis {
  return {
    hasFix: false,
    centerLat: 0,
    centerLon: 0,
    xMeters: new Float32Array(),
    yMeters: new Float32Array(),
    time: new Float32Array(),
    totalDistanceM: 0,
    maxAltitudeM: null,
    minAltitudeM: null,
    maxSpeedMs: null,
    meanSpeedMs: null,
    minSats: null,
  };
}
