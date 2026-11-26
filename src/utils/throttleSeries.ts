import { colorFor } from '../logs/colorFor';
import { shortName } from '../logs/shortName';
import type { LogEntry, PlotSeries } from '../types';
import { align } from './align';

/** Throttle command (rcCommand[3]): one series per log in log colours, or a single purple line. */
export function throttleSeries(entries: LogEntry[], length: number): PlotSeries[] {
  if (entries.length === 1) {
    return [{ label: 'Throttle', values: entries[0]!.log.rcCommand[3]!, stroke: '#bd5dff', width: 1 }];
  }

  return entries.map((e) => ({
    label: shortName(e.slot),
    values: align(e.log.rcCommand[3]!, length),
    stroke: colorFor(e.slot),
    width: 1,
  }));
}
