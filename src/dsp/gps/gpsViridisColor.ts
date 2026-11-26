import { GPS_VIRIDIS_STOPS } from '../../constants';

export function gpsViridisColor(c: number, cMin: number, cMax: number, fallback: string): string {
  if (!Number.isFinite(c) || cMax === -Infinity || !(cMax > cMin)) return fallback;
  const t = Math.max(0, Math.min(1, (c - cMin) / (cMax - cMin)));
  const idx = Math.min(GPS_VIRIDIS_STOPS.length - 1, Math.floor(t * GPS_VIRIDIS_STOPS.length));
  return GPS_VIRIDIS_STOPS[idx]!;
}
