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

  const validAlts: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!gpsCoordValid(gps.lat[i]!, gps.lon[i]!)) continue;
    const a = gps.altitude[i]!;
    if (Number.isFinite(a)) validAlts.push(a);
  }
  if (validAlts.length < 6) return null;

  validAlts.sort((x, y) => x - y);
  const ref = validAlts[Math.min(validAlts.length - 1, Math.floor(validAlts.length * 0.58))]!;
  if (!(ref > 30)) return null;

  const thresh = Math.max(30, Math.min(ref * 0.18, 220));

  let onsetIdx: number | null = null;
  for (let i = 0; i < n; i++) {
    if (!gpsCoordValid(gps.lat[i]!, gps.lon[i]!)) continue;
    const a = gps.altitude[i]!;
    if (!Number.isFinite(a) || a < thresh) continue;
    onsetIdx = i;
    break;
  }
  if (onsetIdx == null) return null;

  let hadBogusBefore = false;
  for (let j = 0; j < onsetIdx; j++) {
    if (!gpsCoordValid(gps.lat[j]!, gps.lon[j]!)) continue;
    const a = gps.altitude[j]!;
    if (Number.isFinite(a) && a <= 12) {
      hadBogusBefore = true;
      break;
    }
  }
  if (!hadBogusBefore) return null;

  return gps.time[onsetIdx]!;
}
