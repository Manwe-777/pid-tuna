import { SLIDER_STEPS } from '../constants';
import { sliderIsLog } from './sliderIsLog';

/** The value at a slider position (0 to `SLIDER_STEPS`), rounded to `step` and kept within [min, max]. */
export function sliderValue(position: number, min: number, max: number, step: number): number {
  const t = Math.min(1, Math.max(0, position / SLIDER_STEPS));
  const raw = sliderIsLog(min, max) ? min * (max / min) ** t : min + t * (max - min);
  const rounded = Math.round(raw / step) * step;

  return Math.min(max, Math.max(min, Number(rounded.toFixed(6))));
}
