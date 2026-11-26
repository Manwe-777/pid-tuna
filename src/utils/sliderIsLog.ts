import { SLIDER_LOG_RATIO } from '../constants';

/** Whether a slider over [min, max] should be logarithmic: a positive range spanning a wide ratio. */
export function sliderIsLog(min: number, max: number): boolean {
  return min > 0 && max / min >= SLIDER_LOG_RATIO;
}
