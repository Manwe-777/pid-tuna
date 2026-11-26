import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import uPlot, { type AlignedData } from 'uplot';

import { PLOT_COLORS } from '../../constants';
import { useTheme } from '../../hooks/useTheme';
import { fingerprintSegmentStrokeColors } from '../../plot/fingerprintSegmentStrokeColors';
import { sameArrays } from '../../plot/sameArrays';
import { type TimeSeriesLive, timeSeriesOptions } from '../../plot/timeSeriesOptions';
import { timeSeriesStructureKey } from '../../plot/timeSeriesStructureKey';
import { ZoomGroup } from '../../plot/ZoomGroup';
import type { PlotArea, PlotBand, PlotEvent, PlotMarker, PlotSeries } from '../../types';
import { PlotOverlays } from './PlotOverlays';
import { PngExportButton } from './PngExportButton';

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
  /** Log events (arming, disarming) drawn as lines with an icon at the top; x is time. */
  events?: readonly PlotEvent[];
  /**
   * One stroke color per segment between adjacent samples (length `time.length - 1`),
   * applied only to the first Y series (`series[0]`). Suppresses the default mono-color path.
   */
  segmentStrokeColors?: readonly string[];
  /** Show uPlot's series legend. Default true. */
  showLegend?: boolean;
  /** Pixel height; width tracks container. */
  height?: number;
  /** Name for the PNG export; defaults to the title or Y label. */
  exportName?: string;
  /** Plots that zoom together and share the selection; read when the plot is built. Defaults to its own. */
  zoomGroup?: ZoomGroup;
  /** Plots with the same key share the cursor. */
  syncKey?: string;
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
  events,
  segmentStrokeColors,
  showLegend = true,
  height = 320,
  exportName,
  zoomGroup,
  syncKey,
}: TimeSeriesPlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  const lastDataRef = useRef<readonly (Float32Array | number[])[] | null>(null);
  const theme = useTheme();
  // Where the plot area is after the last draw, for the event hover targets.
  const [eventLayer, setEventLayer] = useState<{ area: PlotArea; over: HTMLElement } | null>(null);
  const [ownGroup] = useState(() => new ZoomGroup());
  const group = zoomGroup ?? ownGroup;

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
      events,
      onArea: (area, over) =>
        setEventLayer((prev) => (prev?.over === over && sameArea(prev.area, area) ? prev : { area, over })),
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
      zoomGroup: group,
      syncKey,
    });

    const plot = new uPlot(opts, data, container);
    plotRef.current = plot;
    const leaveGroup = group.join(plot);
    lastDataRef.current = [time, ...series.map((s) => s.values)];

    const onResize = () => plot.setSize({ width: container.clientWidth, height });
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    return () => {
      leaveGroup();
      ro.disconnect();
      plot.destroy();
      plotRef.current = null;
      lastDataRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structureKey]);

  // Data updates: only push to uPlot when the underlying typed arrays actually
  // change identity. Calling setData mid-drag would abort the pending selection.
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
  }, [markers, bands, events, segmentStrokeColors]);

  return (
    <div ref={containerRef} className="plot group relative">
      <PngExportButton
        canvases={() => (plotRef.current ? [plotRef.current.ctx.canvas] : [])}
        backgroundOf={() => containerRef.current}
        name={exportName ?? title}
        fallbackName={yLabel ?? 'plot'}
      />
      <PlotOverlays layer={eventLayer} events={events} group={group} />
    </div>
  );
}

function sameArea(a: PlotArea, b: PlotArea): boolean {
  return a.width === b.width && a.height === b.height && a.xMin === b.xMin && a.xMax === b.xMax;
}
