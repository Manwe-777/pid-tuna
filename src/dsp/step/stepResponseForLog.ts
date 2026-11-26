import { STEP_DEFAULTS, STEP_MASK_DEFAULTS } from '../../constants';
import type { ParsedLog, StepLogOptions, StepResponseResult } from '../../types';
import { computeStepResponse } from './computeStepResponse';
import { stepResponseMask } from './stepResponseMask';

/** Step response for one axis of a log, from takeoff to landing, skipping moments with a motor pinned. */
export function stepResponseForLog(log: ParsedLog, axis: number, options: StepLogOptions = {}): StepResponseResult {
  const { flightOnly, minThrottle, maxThrottle, excludeSaturation, ...stepOptions } = {
    ...STEP_DEFAULTS,
    ...STEP_MASK_DEFAULTS,
    ...options,
  };
  const mask = stepResponseMask(log, { flightOnly, minThrottle, maxThrottle, excludeSaturation });

  return computeStepResponse(log.setpoint[axis]!, log.gyroFilt[axis]!, log.setup.looptimeUs, { ...stepOptions, mask });
}
