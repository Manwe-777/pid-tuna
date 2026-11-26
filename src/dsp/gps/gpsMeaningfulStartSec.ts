import type { GpsFrameSeries } from '../../types';
import { gpsCoordValid } from './gpsCoordValid';

/**
 * Infer the first telemetry time after the usual pre-lock plateau (often
 * altitude ≈ 0 and/or very few satellites) when the navigator becomes useful.
 *
 * Only returns a cutoff when there is clearly a bogus prefix (`hadBogusBefore`);
 * otherwise returns `null` so callers keep the full gyro window.
 */
export function gpsMeaningfulStartSec(gps: GpsFrameSeries): number | null {
  const n = gps.time.length;
  if (n < 4) return null;

  const ref = referenceAltitude(gps);
  if (ref == null || !(ref > 30)) return null;

  const thresh = Math.max(30, Math.min(ref * 0.18, 220));
  const onsetIdx = firstFixAtOrAbove(gps, thresh);
  if (onsetIdx == null) return null;

  if (!hasGroundFixBefore(gps, onsetIdx)) return null;

  return gps.time[onsetIdx]!;
}

/** The 58th-percentile altitude of the valid fixes, or null with fewer than 6 of them. */
function referenceAltitude(gps: GpsFrameSeries): number | null {
  const validAlts: number[] = [];

  for (let i = 0; i < gps.time.length; i++) {
    if (!gpsCoordValid(gps.lat[i]!, gps.lon[i]!)) continue;
    const a = gps.altitude[i]!;
    if (Number.isFinite(a)) validAlts.push(a);
  }

  if (validAlts.length < 6) return null;

  validAlts.sort((x, y) => x - y);

  return validAlts[Math.min(validAlts.length - 1, Math.floor(validAlts.length * 0.58))]!;
}

function firstFixAtOrAbove(gps: GpsFrameSeries, thresh: number): number | null {
  for (let i = 0; i < gps.time.length; i++) {
    if (!gpsCoordValid(gps.lat[i]!, gps.lon[i]!)) continue;
    const a = gps.altitude[i]!;
    if (!Number.isFinite(a) || a < thresh) continue;

    return i;
  }

  return null;
}

/** The bogus prefix: a valid fix at (near) zero altitude before the onset. */
function hasGroundFixBefore(gps: GpsFrameSeries, onsetIdx: number): boolean {
  for (let j = 0; j < onsetIdx; j++) {
    if (!gpsCoordValid(gps.lat[j]!, gps.lon[j]!)) continue;
    const a = gps.altitude[j]!;
    if (Number.isFinite(a) && a <= 12) return true;
  }

  return false;
}
