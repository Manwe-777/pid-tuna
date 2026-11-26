import { useMemo } from 'react';

import type { LogEntry, StepBandKind, StepCurveSet, StepSettings } from '../types';
import { stepBandCurves } from '../utils/stepBandCurves';
import { stepLogCurves } from '../utils/stepLogCurves';
import { stepOptionsFrom } from '../utils/stepOptionsFrom';

/** Step-response curves for the settings; display toggles don't trigger a recompute. */
export function useStepCurves(entries: LogEntry[], settings: StepSettings, merge: boolean): StepCurveSet[] {
  const { windowMs, minExcitation, maxExcitation, minThrottle, excludeSaturation, outlierK, settleMin, settleMax } =
    settings;
  const options = useMemo(
    () =>
      stepOptionsFrom({
        windowMs,
        minExcitation,
        maxExcitation,
        minThrottle,
        excludeSaturation,
        outlierK,
        settleMin,
        settleMax,
      }),
    [windowMs, minExcitation, maxExcitation, minThrottle, excludeSaturation, outlierK, settleMin, settleMax],
  );

  return useMemo(() => {
    if (settings.splitBy !== 'none' && entries[0]) {
      return stepBandCurves(entries[0].log, settings.splitBy as StepBandKind, options);
    }

    return stepLogCurves(entries, options, merge);
  }, [entries, options, merge, settings.splitBy]);
}
