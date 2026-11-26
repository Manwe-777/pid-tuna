import { DEFAULT_POLE_PAIRS } from '../../constants';
import type { ParsedLog } from '../../types';
import { motorRpmSeries } from './motorRpmSeries';

/** Median mechanical motor frequency while the motors spin, Hz, or undefined without RPM telemetry. */
export function medianMotorHz(log: ParsedLog): number | undefined {
  const poles = Number.parseFloat(log.setup.rawHeaders.motor_poles ?? '');
  const rpm = motorRpmSeries(log, poles > 0 ? poles / 2 : DEFAULT_POLE_PAIRS);
  if (!rpm) return undefined;

  const spinning = Array.from(rpm)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  if (spinning.length === 0) return undefined;

  return spinning[spinning.length >> 1]! / 60;
}
