import uPlot, { type Options } from 'uplot';

import type { PlotArea, PlotBand, PlotChrome, PlotEvent, PlotMarker, PlotSeries } from '../types';
import { applyPinned } from './applyPinned';
import { drawPlotBands } from './drawPlotBands';
import { drawPlotEvents } from './drawPlotEvents';
import { drawPlotMarkers } from './drawPlotMarkers';
import { drawSegmentStrokeLine } from './drawSegmentStrokeLine';
import { refitYToVisible } from './refitYToVisible';

/** Props the plot callbacks read at call time, so changing them doesn't rebuild the plot. */
export interface TimeSeriesLive {
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  markers?: PlotMarker[];
  bands?: PlotBand[];
  segmentStrokeColors?: readonly string[];
  firstSeriesStrokeWidth: number;
  events?: readonly PlotEvent[];
  /** Called after each draw with uPlot's `over` element and the plot area in CSS px relative to it. */
  onArea?: (area: PlotArea, over: HTMLElement) => void;
}

interface TimeSeriesLayout {
  width: number;
  height: number;
  title?: string;
  yLabel?: string;
  xLabel: string;
  showLegend: boolean;
  series: PlotSeries[];
  chrome: PlotChrome;
  /** The first series is drawn per segment in its own colours instead of as one path. */
  hasSegmentStrokes: boolean;
  live: () => TimeSeriesLive;
}

function drawSegmentStrokes(u: uPlot, live: TimeSeriesLive) {
  const segs = live.segmentStrokeColors;
  const xd = u.data[0];
  const yd = u.data[1];

  if (segs?.length && xd && yd && segs.length === xd.length - 1 && yd.length === xd.length) {
    drawSegmentStrokeLine(u, segs, live.firstSeriesStrokeWidth);
  }
}

/** Draws the log events and reports where the plot area now is, for their hover targets. */
function drawEvents(u: uPlot, live: TimeSeriesLive) {
  const xMin = u.scales.x?.min ?? 0;
  const xMax = u.scales.x?.max ?? 0;
  const { left, top, width, height } = u.bbox;
  drawPlotEvents(u.ctx, live.events, { left, top, width, height, xMin, xMax }, uPlot.pxRatio);
  const cssArea = { left: 0, top: 0, width: width / uPlot.pxRatio, height: height / uPlot.pxRatio, xMin, xMax };
  live.onArea?.(cssArea, u.over);
}

function seriesOptions(series: PlotSeries[], xLabel: string, hasSegmentStrokes: boolean) {
  return [
    { label: xLabel },
    ...series.map((s, idx) => {
      const strokeFirst = idx === 0 && hasSegmentStrokes;

      return {
        label: s.label,
        stroke: s.stroke,
        width: strokeFirst ? 0 : (s.width ?? 1),
        dash: s.dash,
        paths: strokeFirst ? () => null : undefined,
      };
    }),
  ];
}

/** uPlot options for a time-series plot: themed axes, drag-zoom with Y refit, pinned bounds, bands and markers. */
export function timeSeriesOptions(layout: TimeSeriesLayout): Options {
  const { chrome, yLabel, live } = layout;

  const pin = (u: uPlot) => {
    const l = live();
    applyPinned(u, l.xMin, l.xMax, l.yMin, l.yMax);
  };

  return {
    width: layout.width,
    height: layout.height,
    title: layout.title,
    scales: {
      x: { time: false },
      // y left as uPlot default (auto)
    },
    axes: [
      { stroke: chrome.axis, grid: { stroke: chrome.grid }, ticks: { stroke: chrome.grid } },
      {
        stroke: chrome.axis,
        grid: { stroke: chrome.grid },
        ticks: { stroke: chrome.grid },
        label: yLabel,
        labelSize: yLabel ? 28 : 0,
      },
    ],
    legend: { show: layout.showLegend },
    cursor: {
      drag: { x: true, y: false, setScale: true },
      bind: {
        // Double-click resets to the caller-pinned bounds (or to auto if no
        // bound was specified for that side). Returning a non-null handler
        // suppresses uPlot's default reset.
        dblclick: (u) => () => {
          pin(u);

          return null;
        },
      },
    },
    series: seriesOptions(layout.series, layout.xLabel, layout.hasSegmentStrokes),
    hooks: {
      drawClear: [(u) => drawPlotBands(u, live().bands)],
      // Set the caller-pinned bounds once data is loaded but before the first
      // paint — avoids a flash of the auto-fit range.
      ready: [pin],
      setScale: [
        (u, key) => {
          if (key === 'x') refitYToVisible(u, live().xMin, live().xMax);
        },
      ],
      draw: [
        (u) => {
          drawSegmentStrokes(u, live());
          drawPlotMarkers(u, live().markers);
          drawEvents(u, live());
        },
      ],
    },
  };
}
