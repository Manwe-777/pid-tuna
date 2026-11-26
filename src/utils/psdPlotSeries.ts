import { AXIS_COLORS } from '../constants';
import { colorFor } from '../logs/colorFor';
import { shortName } from '../logs/shortName';
import type { PlotSeries, PsdAxisItem } from '../types';

/** Plot series for one axis: coloured per log with several logs, else per signal (axis colour for filtered gyro). */
export function psdPlotSeries(items: PsdAxisItem[], axis: number, multi: boolean): PlotSeries[] {
  return items.flatMap(({ def, perLog }) =>
    perLog.map(({ slot, psd }) =>
      multi
        ? { label: shortName(slot), values: psd, stroke: colorFor(slot), width: 1.4 }
        : { label: def.label, values: psd, stroke: def.key === 'gyroFilt' ? AXIS_COLORS[axis]! : def.color, width: 1 },
    ),
  );
}
