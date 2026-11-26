import { AXIS_COLORS, AXIS_NAMES, BAND_COLORS } from '../constants';
import { stepResponseBands } from '../dsp/step/stepResponseBands';
import type { ParsedLog, StepBandKind, StepCurveSet, StepLogOptions } from '../types';

/** One curve set per stick-input or throttle band of one log, all three axes each. */
export function stepBandCurves(log: ParsedLog, kind: StepBandKind, options: StepLogOptions): StepCurveSet[] {
  const perAxis = AXIS_NAMES.map((_n, i) => stepResponseBands(log, i, kind, options));

  return perAxis[0]!.map((band, b) => ({
    id: `band-${b}`,
    label: band.label,
    color: BAND_COLORS[b % BAND_COLORS.length]!,
    dash: [],
    axes: AXIS_NAMES.map((name, i) => ({ name, color: AXIS_COLORS[i]!, ...perAxis[i]![b]!.result })),
  }));
}
