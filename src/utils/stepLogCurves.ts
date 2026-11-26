import { AXIS_COLORS, AXIS_NAMES } from '../constants';
import { combineStepResponses } from '../dsp/step/combineStepResponses';
import { colorFor } from '../logs/colorFor';
import { shortName } from '../logs/shortName';
import type { LogEntry, StepCurveSet, StepLogOptions } from '../types';
import { computeAxisSteps } from './computeAxisSteps';
import { makeMergedSlot } from './makeMergedSlot';

/** One curve set per log, or a single set pooling every log's windows when merging. */
export function stepLogCurves(entries: LogEntry[], options: StepLogOptions, merge: boolean): StepCurveSet[] {
  const perLog = entries.map(({ slot, log, dash }) => ({
    id: slot.id,
    label: shortName(slot),
    color: colorFor(slot),
    dash,
    axes: computeAxisSteps(log, options),
  }));
  if (!merge) return perLog;

  const merged = makeMergedSlot(entries);
  const mergedAxes = AXIS_NAMES.map((name, i) => ({
    name,
    color: AXIS_COLORS[i]!,
    ...combineStepResponses(perLog.map((p) => p.axes[i]!)),
  }));

  return [{ id: merged.id, label: shortName(merged), color: colorFor(merged), dash: [], axes: mergedAxes }];
}
