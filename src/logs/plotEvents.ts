import { LOG_EVENT_STYLES } from '../constants';
import type { LogEntry, PlotEvent } from '../types';
import { shortName } from './shortName';

/**
 * The arm and disarm events of the given logs, labelled for plot tooltips.
 * With several logs, each label names its log. `toPlotTime` maps log time onto
 * a plot whose time axis is counted differently; labels keep log time.
 */
export function plotEvents(
  entries: readonly Pick<LogEntry, 'log' | 'slot'>[],
  toPlotTime: (t: number) => number = (t) => t,
): PlotEvent[] {
  const named = entries.length > 1;

  return entries.flatMap(({ log, slot }) =>
    log.events.map((e) => ({
      time: toPlotTime(e.time),
      kind: e.kind,
      label: `${LOG_EVENT_STYLES[e.kind].label} at ${e.time.toFixed(2)} s${named ? ` · ${shortName(slot)}` : ''}`,
    })),
  );
}
