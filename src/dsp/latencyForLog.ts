import type { LatencyResult, ParsedLog } from '../types';
import { computeXcorrLatency } from './computeXcorrLatency';
import { stepResponseMask } from './step/stepResponseMask';

/** Tracking latency for one axis of a log, from takeoff to landing. */
export function latencyForLog(log: ParsedLog, axis: number): LatencyResult {
  const mask = stepResponseMask(log, { flightOnly: true });

  return computeXcorrLatency(log.setpoint[axis]!, log.gyroFilt[axis]!, log.setup.sampleRateHz, { mask });
}
