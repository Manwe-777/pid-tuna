import type { GpsAnalysis } from '../types';

/** Display strings for a log's GPS figures; missing values read "—". */
export function gpsStatTexts(a: GpsAnalysis) {
  return {
    distance: `${(a.totalDistanceM / 1000).toFixed(2)} km`,
    maxAlt: a.maxAltitudeM != null ? `${a.maxAltitudeM.toFixed(0)} m` : '—',
    maxSpeedShort: a.maxSpeedMs != null ? `${a.maxSpeedMs.toFixed(1)} m/s` : '—',
    maxSpeed: a.maxSpeedMs != null ? `${a.maxSpeedMs.toFixed(1)} m/s · ${(a.maxSpeedMs * 3.6).toFixed(0)} km/h` : '—',
    avgSpeed: a.meanSpeedMs != null ? `${a.meanSpeedMs.toFixed(1)} m/s` : '—',
    minSats: a.minSats != null ? `${a.minSats}` : '—',
  };
}
