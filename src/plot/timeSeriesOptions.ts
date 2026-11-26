import type uPlot from 'uplot';
import type { Options } from 'uplot';

import type { PlotBand, PlotChrome, PlotMarker, PlotSeries } from '../types';
import { applyPinned } from './applyPinned';
import { drawPlotBands } from './drawPlotBands';
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
        },
      ],
    },
  };
}
