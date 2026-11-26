import type { ParsedLog } from '../types';
import { computeStepResponse, STEP_DEFAULTS, type StepResponseOptions, type StepResponseResult } from './stepResponse';
import { type StepMaskOptions, stepResponseMask } from './stepResponseMask';

/** Takeoff to landing, minus moments at idle throttle (motors at idle respond differently) or with a motor pinned. */
export const STEP_MASK_DEFAULTS = { flightOnly: true, minThrottle: 5, maxThrottle: Infinity, excludeSaturation: true };

export type StepLogOptions = StepResponseOptions & StepMaskOptions;

/** Step response for one axis of a log, from takeoff to landing, skipping moments with a motor pinned. */
export function stepResponseForLog(log: ParsedLog, axis: number, options: StepLogOptions = {}): StepResponseResult {
  const { flightOnly, minThrottle, maxThrottle, excludeSaturation, ...stepOptions } = { ...STEP_DEFAULTS, ...STEP_MASK_DEFAULTS, ...options };
  const mask = stepResponseMask(log, { flightOnly, minThrottle, maxThrottle, excludeSaturation });

  return computeStepResponse(log.setpoint[axis]!, log.gyroFilt[axis]!, log.setup.looptimeUs, { ...stepOptions, mask });
}
