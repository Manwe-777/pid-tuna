import type { GpsSample } from '../../types';
import { gpsCoordValid } from './gpsCoordValid';

export function buildValidGpsSamples(gpsTime: Float32Array, lat: Float32Array, lon: Float32Array): GpsSample[] {
  const out: GpsSample[] = [];

  for (let i = 0; i < gpsTime.length; i++) {
    const la = lat[i]!;
    const lo = lon[i]!;
    if (!gpsCoordValid(la, lo)) continue;
    out.push({ t: gpsTime[i]!, lat: la, lon: lo });
  }

  return out;
}
