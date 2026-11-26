import uPlot, { type Options } from 'uplot';

import { PLOT_CLICK_SLOP_PX } from '../constants';
import type { PlotArea, PlotBand, PlotChrome, PlotEvent, PlotMarker, PlotSeries } from '../types';
import { applyPinned } from './applyPinned';
import { drawPlotBands } from './drawPlotBands';
import { drawPlotEvents } from './drawPlotEvents';
import { drawPlotMarkers } from './drawPlotMarkers';
import { drawSegmentStrokeLine } from './drawSegmentStrokeLine';
import { isFullXRange } from './isFullXRange';
import { isOutsideSpan } from './isOutsideSpan';
import { refitYToVisible } from './refitYToVisible';
import { resetXScale } from './resetXScale';
import type { ZoomGroup } from './ZoomGroup';

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
  /** Plots that zoom together and share the dragged-out selection. */
  zoomGroup: ZoomGroup;
  /** Plots with the same key share the cursor. */
  syncKey?: string;
}

function drawSegmentStrokes(u: uPlot, live: TimeSeriesLive) {
  const segs = live.segmentStrokeColors;
  const xd = u.data[0];
  const yd = u.data[1];

  if (segs?.length && xd && yd && segs.length === xd.length - 1 && yd.length === xd.length) {
    drawSegmentStrokeLine(u, segs, live.firstSeriesStrokeWidth);
  }
}

/**
 * Mouse bindings that clear the selection on a click (not a drag) outside it. Presses on the
 * selection's edges and label never reach uPlot, so they keep it.
 */
function clickOutsideClears(group: ZoomGroup) {
  let downX = Number.NaN;

  return {
    mousedown: (_u: uPlot, _t: HTMLElement, handler: (e: MouseEvent) => null) => (e: MouseEvent) => {
      downX = e.clientX;

      return handler(e);
    },
    mouseup: (u: uPlot, _t: HTMLElement, handler: (e: MouseEvent) => null) => (e: MouseEvent) => {
      if (Math.abs(e.clientX - downX) < PLOT_CLICK_SLOP_PX) {
        const value = u.posToVal(e.clientX - u.over.getBoundingClientRect().left, 'x');
        if (isOutsideSpan(group.selection, value)) group.select(null);
      }

      return handler(e);
    },
  };
}

/** Whether the plot shows its whole default X range. */
function showsAllX(u: uPlot, live: TimeSeriesLive): boolean {
  const xd = u.data[0];
  if (!xd?.length) return true;

  return isFullXRange(u.scales.x ?? {}, { first: xd[0]!, last: xd[xd.length - 1]! }, live);
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
      // Dragging picks a span; a double-click zooms into it.
      drag: { x: true, y: false, setScale: false },
      // Share the time only: other plots' Y axes have other units, so they hide the horizontal line.
      sync: layout.syncKey
        ? { key: layout.syncKey, setSeries: false, match: [(a, b) => a === b, () => false] }
        : undefined,
      bind: {
        ...clickOutsideClears(layout.zoomGroup),
        // Double-click zooms into the selection. Without one it zooms back out
        // to the default range.
        dblclick: (u) => () => {
          if (layout.zoomGroup.zoomToSelection(u)) return null;
          resetXScale(u, live().xMin, live().xMax);
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
      // Hand a finished drag to the group, which draws it as an adjustable selection.
      setSelect: [
        (u) => {
          const { left, width } = u.select;
          if (width < 2) return;
          layout.zoomGroup.select({ min: u.posToVal(left, 'x'), max: u.posToVal(left + width, 'x') });
          u.setSelect({ left: 0, top: 0, width: 0, height: 0 }, false);
        },
      ],
      setScale: [
        (u, key) => {
          if (key !== 'x') return;
          refitYToVisible(u, live().xMin, live().xMax);
          layout.zoomGroup.publish(u, showsAllX(u, live()));
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
