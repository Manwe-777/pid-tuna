import { AXIS_COLORS, AXIS_NAMES } from '../constants';
import { stepResponseForLog } from '../dsp/step/stepResponseForLog';
import type { ParsedLog, StepLogOptions } from '../types';

export function computeAxisSteps(log: ParsedLog, options: StepLogOptions = {}) {
  return AXIS_NAMES.map((name, i) => ({ name, color: AXIS_COLORS[i]!, ...stepResponseForLog(log, i, options) }));
}
