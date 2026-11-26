import type { AxisStepWithSlot, PlotSeries } from '../types';
import { align } from './align';
import { hexWithAlpha } from './hexWithAlpha';

interface StepPlotOptions {
  timeLength: number;
  axisColor: string;
  showSegments: boolean;
  showSpread: boolean;
}

/** Dashed lines one spread above and below the estimate. */
function spreadSeries(mean: Float32Array, spread: Float32Array, color: string): PlotSeries[] {
  const bandColor = hexWithAlpha(color, 0.55);
  const lo = mean.map((v, k) => v - (spread[k] ?? 0));
  const hi = mean.map((v, k) => v + (spread[k] ?? 0));

  return [
    { label: '', values: lo, stroke: bandColor, width: 1, dash: [3, 3] },
    { label: '', values: hi, stroke: bandColor, width: 1, dash: [3, 3] },
  ];
}

/** Series for one entry: faint single windows (one log only), the spread band, then the bold estimate. */
function entrySeries(entry: AxisStepWithSlot, multi: boolean, o: StepPlotOptions): PlotSeries[] {
  const { label, dash, data } = entry;
  const color = multi ? entry.color : o.axisColor;
  const mean = align(data.mean, o.timeLength);
  const out: PlotSeries[] = [];

  if (!multi && o.showSegments) {
    const segColor = hexWithAlpha(o.axisColor, 0.18);
    for (const seg of data.segments) out.push({ label: '', values: seg, stroke: segColor, width: 0.6 });
  }

  if (o.showSpread && data.spread.length === data.mean.length) out.push(...spreadSeries(mean, data.spread, color));

  out.push({
    label: multi ? label : 'Estimate',
    values: mean,
    stroke: color,
    width: 2,
    dash: multi && dash.length ? dash : undefined,
  });

  return out;
}

/** Plot series for one axis of the step response, skipping entries without an estimate. */
export function stepPlotSeries(perLog: AxisStepWithSlot[], o: StepPlotOptions): PlotSeries[] {
  const multi = perLog.length > 1;

  return perLog.filter((p) => p.data.mean.length > 0).flatMap((p) => entrySeries(p, multi, o));
}
