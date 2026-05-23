/** GPS fixes suitable for interpolation (same clock as main-loop `time`). */
export interface GpsSample {
  t: number;
  lat: number;
  lon: number;
}

export function gpsCoordValid(la: number, lo: number): boolean {
  return Number.isFinite(la) && Number.isFinite(lo) && !(la === 0 && lo === 0);
}

export function buildValidGpsSamples(
  gpsTime: Float32Array,
  lat: Float32Array,
  lon: Float32Array,
): GpsSample[] {
  const out: GpsSample[] = [];
  for (let i = 0; i < gpsTime.length; i++) {
    const la = lat[i]!;
    const lo = lon[i]!;
    if (!gpsCoordValid(la, lo)) continue;
    out.push({ t: gpsTime[i]!, lat: la, lon: lo });
  }
  return out;
}

/** Linear interpolate lat/lon at time `t` along GPS fixes. */
export function interpolateGps(samples: GpsSample[], t: number): [number, number] | null {
  if (samples.length === 0) return null;
  if (samples.length === 1) return [samples[0]!.lat, samples[0]!.lon];
  if (t <= samples[0]!.t) return [samples[0]!.lat, samples[0]!.lon];
  const last = samples[samples.length - 1]!;
  if (t >= last.t) return [last.lat, last.lon];

  let lo = 0;
  let hi = samples.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >>> 1;
    if (samples[mid]!.t <= t) lo = mid;
    else hi = mid;
  }
  const a = samples[lo]!;
  const b = samples[hi]!;
  const u = (t - a.t) / (b.t - a.t);
  return [a.lat + (b.lat - a.lat) * u, a.lon + (b.lon - a.lon) * u];
}

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371008.8;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = φ2 - φ1;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const sΔφ = Math.sin(Δφ / 2);
  const sΔλ = Math.sin(Δλ / 2);
  const hh = sΔφ * sΔφ + Math.cos(φ1) * Math.cos(φ2) * sΔλ * sΔλ;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(hh)));
}

/** Initial geographic bearing from point A toward B (degrees, clockwise from north). */
export function bearingDegrees(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = (Math.atan2(y, x) * 180) / Math.PI;
  return normalizeHeadingDeg(θ);
}

export function normalizeHeadingDeg(d: number): number {
  let x = d % 360;
  if (x < 0) x += 360;
  return x;
}

/** Bearing of the local GPS chord that contains playback time `t`. */
function segmentHeadingAt(samples: GpsSample[], t: number): number | null {
  if (samples.length < 2) return null;
  if (t <= samples[0]!.t) {
    const a = samples[0]!;
    const b = samples[1]!;
    return bearingDegrees(a.lat, a.lon, b.lat, b.lon);
  }
  const end = samples[samples.length - 1]!;
  if (t >= end.t) {
    const prev = samples[samples.length - 2]!;
    return bearingDegrees(prev.lat, prev.lon, end.lat, end.lon);
  }
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]!;
    const b = samples[i]!;
    if (a.t <= t && t <= b.t) return bearingDegrees(a.lat, a.lon, b.lat, b.lon);
  }
  return null;
}

const LOOK_DELTA_SEC = [0.06, 0.14, 0.28, 0.55, 1, 1.8, 3.3, 5.8, 9];
const MIN_STEP_M = 2.8;

/**
 * Direction of travel along the logged GPS track at time `t` (clockwise ° from north).
 * Matches what you see on the map path — not body-frame gyro yaw (which diverges under bank /
 * slip even when gyro data looks fine).
 */
export function headingAlongTrack(samples: GpsSample[], t: number): number {
  if (samples.length < 2) return 0;

  const tMin = samples[0]!.t;
  const tMax = samples[samples.length - 1]!.t;
  const tc = Math.max(tMin, Math.min(tMax, t));

  const p0 = interpolateGps(samples, tc);
  if (!p0) return 0;

  for (let i = 0; i < LOOK_DELTA_SEC.length; i++) {
    const dt = LOOK_DELTA_SEC[i]!;
    const tForward = Math.min(tMax, tc + dt);
    if (tForward > tc + 1e-9) {
      const pf = interpolateGps(samples, tForward)!;
      if (distanceMeters(p0[0], p0[1], pf[0], pf[1]) >= MIN_STEP_M) {
        return bearingDegrees(p0[0], p0[1], pf[0], pf[1]);
      }
    }
    const tBack = Math.max(tMin, tc - dt);
    if (tBack < tc - 1e-9) {
      const pb = interpolateGps(samples, tBack)!;
      if (distanceMeters(pb[0], pb[1], p0[0], p0[1]) >= MIN_STEP_M) {
        return bearingDegrees(pb[0], pb[1], p0[0], p0[1]);
      }
    }
  }

  const seg = segmentHeadingAt(samples, tc);
  if (seg != null) return seg;

  return bearingDegrees(samples[0]!.lat, samples[0]!.lon, samples[1]!.lat, samples[1]!.lon);
}
