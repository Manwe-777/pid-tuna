import { AXIS_COLORS, AXIS_NAMES } from '../constants';
import { type StepLogOptions, stepResponseForLog } from '../dsp/stepResponseForLog';
import type { ParsedLog } from '../types';

export function computeAxisSteps(log: ParsedLog, options: StepLogOptions = {}) {
  return AXIS_NAMES.map((name, i) => ({ name, color: AXIS_COLORS[i]!, ...stepResponseForLog(log, i, options) }));
}
