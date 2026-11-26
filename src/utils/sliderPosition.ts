import { SLIDER_STEPS } from '../constants';
import { sliderIsLog } from './sliderIsLog';

/** Where `value` sits on a slider over [min, max], as a position from 0 to `SLIDER_STEPS`. */
export function sliderPosition(value: number, min: number, max: number): number {
  const v = Math.min(max, Math.max(min, value));
  const t = sliderIsLog(min, max) ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min || 1);

  return Math.round(t * SLIDER_STEPS);
}
