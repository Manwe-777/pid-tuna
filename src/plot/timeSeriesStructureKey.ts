import type { PlotSeries, Theme } from '../types';

/** Everything that requires rebuilding the uPlot instance; the plot is recreated only when this string changes. */
export function timeSeriesStructureKey(parts: {
  title?: string;
  yLabel?: string;
  xLabel: string;
  showLegend: boolean;
  height: number;
  series: PlotSeries[];
  theme: Theme;
  segmentStrokeDigest: string;
}): string {
  return [
    parts.title ?? '',
    parts.yLabel ?? '',
    parts.xLabel,
    parts.showLegend ? 'L' : '',
    parts.height,
    parts.series.length,
    parts.theme,
    parts.segmentStrokeDigest,
    ...parts.series.map((s) => `${s.label}|${s.stroke}|${s.width ?? 1}|${(s.dash ?? []).join(',')}`),
  ].join('§');
}
