import 'uplot/dist/uPlot.min.css';

import { useEffect, useLayoutEffect, useRef } from 'react';
import uPlot, { type AlignedData } from 'uplot';

import { PLOT_COLORS } from '../../constants';
import { useTheme } from '../../hooks/useTheme';
import { fingerprintSegmentStrokeColors } from '../../plot/fingerprintSegmentStrokeColors';
import { sameArrays } from '../../plot/sameArrays';
import { type TimeSeriesLive, timeSeriesOptions } from '../../plot/timeSeriesOptions';
import { timeSeriesStructureKey } from '../../plot/timeSeriesStructureKey';
import type { PlotBand, PlotMarker, PlotSeries } from '../../types';

interface TimeSeriesPlotProps {
  /** X-axis values. */
  time: Float32Array;
  series: PlotSeries[];
  title?: string;
  /** Y-axis label, e.g. 'deg/s'. */
  yLabel?: string;
  /** X-axis label / first-series label. Default "t (s)". */
  xLabel?: string;
  /** Pin x range. Pass either bound to apply, both for a fixed window. */
  xMin?: number;
  xMax?: number;
  /** Pin y range. */
  yMin?: number;
  yMax?: number;
  /** Vertical markers drawn over the plot (e.g. RPM harmonic frequencies). */
  markers?: PlotMarker[];
  /** Horizontal background bands drawn behind the data (e.g. saturation runs). */
  bands?: PlotBand[];
  /**
   * One stroke color per segment between adjacent samples (length `time.length - 1`),
   * applied only to the first Y series (`series[0]`). Suppresses the default mono-color path.
   */
  segmentStrokeColors?: readonly string[];
  /** Show uPlot's series legend. Default true. */
  showLegend?: boolean;
  /** Pixel height; width tracks container. */
  height?: number;
}

export function TimeSeriesPlot({
  time,
  series,
  title,
  yLabel,
  xLabel = 't (s)',
  xMin,
  xMax,
  yMin,
  yMax,
  markers,
  bands,
  segmentStrokeColors,
  showLegend = true,
  height = 320,
}: TimeSeriesPlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  const lastDataRef = useRef<readonly (Float32Array | number[])[] | null>(null);
  const theme = useTheme();

  // The latest prop values, so callbacks (dblclick, Y-autofit, draw hooks) see
  // them without forcing a plot rebuild when they change.
  const liveRef = useRef<TimeSeriesLive>({ firstSeriesStrokeWidth: 1 });
  useLayoutEffect(() => {
    liveRef.current = {
      xMin,
      xMax,
      yMin,
      yMax,
      markers,
      bands,
      segmentStrokeColors,
      firstSeriesStrokeWidth: series[0]?.width ?? 1,
    };
  });

  // `theme` is part of the key so axis / grid chrome recolors when the user toggles.
  const structureKey = timeSeriesStructureKey({
    title,
    yLabel,
    xLabel,
    showLegend,
    height,
    series,
    theme,
    segmentStrokeDigest: fingerprintSegmentStrokeColors(segmentStrokeColors),
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const data: AlignedData = [time, ...series.map((s) => s.values)] as AlignedData;
    const hasSegmentStrokes =
      segmentStrokeColors != null && segmentStrokeColors.length === time.length - 1 && series.length >= 1;
    const opts = timeSeriesOptions({
      width: container.clientWidth,
      height,
      title,
      yLabel,
      xLabel,
      showLegend,
      series,
      chrome: PLOT_COLORS[theme],
      hasSegmentStrokes,
      live: () => liveRef.current,
    });

    const plot = new uPlot(opts, data, container);
    plotRef.current = plot;
    lastDataRef.current = [time, ...series.map((s) => s.values)];

    const onResize = () => plot.setSize({ width: container.clientWidth, height });
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    return () => {
      ro.disconnect();
      plot.destroy();
      plotRef.current = null;
      lastDataRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structureKey]);

  // Data updates: only push to uPlot when the underlying typed arrays actually
  // change identity. Calling setData mid-drag would abort the pending zoom.
  useEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;
    const next: (Float32Array | number[])[] = [time, ...series.map((s) => s.values)];
    if (sameArrays(lastDataRef.current, next)) return;

    lastDataRef.current = next;
    plot.setData(next as AlignedData, false);
  });

  // Redraw on marker / band changes (cheap — no scale reset).
  useEffect(() => {
    plotRef.current?.redraw(false);
  }, [markers, bands, segmentStrokeColors]);

  return <div ref={containerRef} className="plot" />;
}
