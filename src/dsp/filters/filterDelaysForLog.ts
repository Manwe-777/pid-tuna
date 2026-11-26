import { buildTuneView } from '../../tune/buildTuneView';
import type { FilterDelayBreakdown, ParsedLog } from '../../types';
import { medianMotorHz } from '../spectrum/medianMotorHz';
import { computeFilterDelays } from './computeFilterDelays';

/** Filter delay breakdown for a log, placing RPM notches at its measured motor frequency. */
export function filterDelaysForLog(log: ParsedLog, referenceHz?: number): FilterDelayBreakdown {
  return computeFilterDelays(buildTuneView(log), {
    motorCount: log.motor.length || undefined,
    motorHz: medianMotorHz(log),
    referenceHz,
  });
}
