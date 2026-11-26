import { DEFAULT_POLE_PAIRS } from '../../constants';
import type { ParsedLog } from '../../types';

/**
 * Per-motor mechanical rotation frequency in Hz, sample by sample, from eRPM
 * telemetry (Betaflight logs eRPM / 100). Pole pairs come from the
 * `motor_poles` header, or `polePairs` when given. 0 where a motor isn't
 * spinning; null without RPM telemetry.
 */
export function motorHzSeries(log: ParsedLog, polePairs?: number): Float32Array[] | null {
  const poles = Number.parseFloat(log.setup.rawHeaders.motor_poles ?? '');
  const pairs = polePairs ?? (poles >= 2 ? poles / 2 : DEFAULT_POLE_PAIRS);
  const motors = log.eRpm.filter((m) => m.length === log.time.length && m.some((v) => v > 0));
  if (motors.length === 0 || pairs <= 0) return null;

  const scale = 100 / pairs / 60;

  return motors.map((m) => Float32Array.from(m, (v) => (Number.isFinite(v) && v > 0 ? v * scale : 0)));
}
