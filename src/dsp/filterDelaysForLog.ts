import type { ParsedLog } from '../types';
import { buildTuneView } from '../tuneView';
import { computeFilterDelays, type FilterDelayBreakdown } from './filterDelays';
import { medianMotorHz } from './medianMotorHz';

/** Filter delay breakdown for a log, placing RPM notches at its measured motor frequency. */
export function filterDelaysForLog(log: ParsedLog, referenceHz?: number): FilterDelayBreakdown {
  return computeFilterDelays(buildTuneView(log), { motorCount: log.motor.length || undefined, motorHz: medianMotorHz(log), referenceHz });
}
