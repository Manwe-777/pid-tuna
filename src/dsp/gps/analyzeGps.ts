import type { GpsAnalysis, GpsFrameSeries } from '../../types';
import { gpsCoordValid } from './gpsCoordValid';

const M_PER_DEG_LAT = 111320;

type FlightStats = Pick<GpsAnalysis, 'maxAltitudeM' | 'minAltitudeM' | 'maxSpeedMs' | 'meanSpeedMs' | 'minSats'>;

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

  const center = fixCenter(gps);
  if (center == null) return emptyAnalysis();

  const { centerLat, centerLon } = center;
  const { xMeters, yMeters } = projectToMeters(gps, centerLat, centerLon);

  return {
    hasFix: true,
    centerLat,
    centerLon,
    xMeters,
    yMeters,
    time: gps.time,
    totalDistanceM: pathLength(xMeters, yMeters),
    ...flightStats(gps),
  };
}

/** Mean position of the valid fixes, or null when there are none. */
function fixCenter(gps: GpsFrameSeries): { centerLat: number; centerLon: number } | null {
  // Filter to valid points (non-zero coords; some firmwares emit (0,0) before fix).
  let latSum = 0;
  let latCount = 0;
  let lonSum = 0;

  for (let i = 0; i < gps.time.length; i++) {
    const la = gps.lat[i]!;
    const lo = gps.lon[i]!;
    if (!gpsCoordValid(la, lo)) continue;
    latSum += la;
    lonSum += lo;
    latCount++;
  }

  if (latCount === 0) return null;

  return { centerLat: latSum / latCount, centerLon: lonSum / latCount };
}

/** Equirectangular meters around the center; NaN where there is no fix. */
function projectToMeters(gps: GpsFrameSeries, centerLat: number, centerLon: number) {
  const n = gps.time.length;
  const mPerDegLon = M_PER_DEG_LAT * Math.cos((centerLat * Math.PI) / 180);
  const xMeters = new Float32Array(n);
  const yMeters = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const la = gps.lat[i]!;
    const lo = gps.lon[i]!;

    if (gpsCoordValid(la, lo)) {
      xMeters[i] = (lo - centerLon) * mPerDegLon;
      yMeters[i] = (la - centerLat) * M_PER_DEG_LAT;
    } else {
      xMeters[i] = NaN;
      yMeters[i] = NaN;
    }
  }

  return { xMeters, yMeters };
}

/** Total distance: sum of segment lengths skipping NaN segments. */
function pathLength(xMeters: Float32Array, yMeters: Float32Array): number {
  let totalDistanceM = 0;

  for (let i = 1; i < xMeters.length; i++) {
    const dx = xMeters[i]! - xMeters[i - 1]!;
    const dy = yMeters[i]! - yMeters[i - 1]!;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) continue;

    const d = Math.hypot(dx, dy);
    if (d < 5000 /* clamp impossible jumps */) totalDistanceM += d;
  }

  return totalDistanceM;
}

function flightStats(gps: GpsFrameSeries): FlightStats {
  const n = gps.time.length;

  return { ...altitudeRange(gps.altitude, n), ...speedStats(gps.speed, n), minSats: minSatellites(gps.numSat, n) };
}

function altitudeRange(altitude: Float32Array, n: number): Pick<FlightStats, 'maxAltitudeM' | 'minAltitudeM'> {
  let maxAlt = -Infinity;
  let minAlt = Infinity;

  for (let i = 0; i < n; i++) {
    const a = altitude[i]!;
    if (!Number.isFinite(a)) continue;
    if (a > maxAlt) maxAlt = a;
    if (a < minAlt) minAlt = a;
  }

  return {
    maxAltitudeM: maxAlt === -Infinity ? null : maxAlt,
    minAltitudeM: minAlt === Infinity ? null : minAlt,
  };
}

function speedStats(speed: Float32Array, n: number): Pick<FlightStats, 'maxSpeedMs' | 'meanSpeedMs'> {
  let maxSpd = -Infinity;
  let spdSum = 0;
  let spdN = 0;

  for (let i = 0; i < n; i++) {
    const s = speed[i]!;
    if (!Number.isFinite(s)) continue;
    if (s > maxSpd) maxSpd = s;
    spdSum += s;
    spdN++;
  }

  return {
    maxSpeedMs: maxSpd === -Infinity ? null : maxSpd,
    meanSpeedMs: spdN > 0 ? spdSum / spdN : null,
  };
}

function minSatellites(numSat: Float32Array, n: number): number | null {
  let minSats = Infinity;

  for (let i = 0; i < n; i++) {
    const ns = numSat[i]!;
    if (Number.isFinite(ns) && ns < minSats) minSats = ns;
  }

  return minSats === Infinity ? null : minSats;
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
