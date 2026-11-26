import type { ParsedLog } from '../types';
import { computeStepResponse, STEP_DEFAULTS, type StepResponseOptions, type StepResponseResult } from './stepResponse';
import { type StepMaskOptions, stepResponseMask } from './stepResponseMask';

export const STEP_MASK_DEFAULTS: Required<StepMaskOptions> = { minThrottle: 15, excludeSaturation: true };

export type StepLogOptions = StepResponseOptions & StepMaskOptions;

/** Step response for one axis of a log, skipping time on the ground, at idle or with motors pinned. */
export function stepResponseForLog(log: ParsedLog, axis: number, options: StepLogOptions = {}): StepResponseResult {
  const { minThrottle, excludeSaturation, ...stepOptions } = { ...STEP_DEFAULTS, ...STEP_MASK_DEFAULTS, ...options };
  const mask = stepResponseMask(log, { minThrottle, excludeSaturation });

  return computeStepResponse(log.setpoint[axis]!, log.gyroFilt[axis]!, log.setup.looptimeUs, { ...stepOptions, mask });
}
