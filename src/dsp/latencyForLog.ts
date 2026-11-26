import type { ParsedLog } from '../types';
import { computeXcorrLatency, type LatencyResult } from './latency';
import { STEP_MASK_DEFAULTS } from './stepResponseForLog';
import { stepResponseMask } from './stepResponseMask';

/** Tracking latency for one axis of a log, counting only time in the air. */
export function latencyForLog(log: ParsedLog, axis: number): LatencyResult {
  const mask = stepResponseMask(log, { minThrottle: STEP_MASK_DEFAULTS.minThrottle });

  return computeXcorrLatency(log.setpoint[axis]!, log.gyroFilt[axis]!, log.setup.sampleRateHz, { mask });
}
