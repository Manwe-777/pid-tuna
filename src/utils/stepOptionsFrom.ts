import type { StepLogOptions, StepSettings } from '../types';

export function stepOptionsFrom(settings: StepSettings): StepLogOptions {
  return {
    windowMs: settings.windowMs,
    minExcitation: settings.minExcitation,
    maxExcitation: settings.maxExcitation > 0 ? settings.maxExcitation : Infinity,
    minThrottle: settings.minThrottle,
    excludeSaturation: settings.excludeSaturation,
    outlierK: settings.outlierK,
    settleMin: settings.settleMin,
    settleMax: settings.settleMax,
  };
}
