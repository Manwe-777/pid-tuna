import { DEFAULT_POLE_PAIRS } from '../../constants';
import type { ParsedLog } from '../../types';

/**
 * Mean mechanical motor RPM per sample, averaged across all motors with eRPM
 * telemetry. Betaflight logs eRPM as electrical_RPM / 100, so
 * mechanical RPM = eRPM_logged * 100 / polePairs (mirrors `computeRpmMarkers`).
 * Returns null if no motor has usable eRPM data.
 */
export function motorRpmSeries(log: ParsedLog, polePairs: number = DEFAULT_POLE_PAIRS): Float32Array | null {
  const motors = log.eRpm.filter((a) => a.length === log.time.length && a.some((v) => v > 0));
  if (motors.length === 0 || polePairs <= 0) return null;

  const n = log.time.length;
  const scale = 100 / polePairs;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (const m of motors) {
      const v = m[i]!;
      if (Number.isFinite(v) && v > 0) {
        sum += v;
        count++;
      }
    }
    out[i] = count > 0 ? (sum / count) * scale : 0;
  }
  return out;
}
