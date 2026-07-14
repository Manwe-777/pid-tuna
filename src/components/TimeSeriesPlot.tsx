import { useEffect, useRef } from 'react';
import uPlot, { type AlignedData, type Options } from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { PLOT_COLORS, useTheme } from '../theme';

export interface PlotSeries {
  label: string;
  /** Sample values; length must equal `time.length`. */
  values: Float32Array;
  /** CSS color. */
  stroke: string;
  /** Optional dash pattern, e.g. [4, 4]. */
  dash?: number[];
  /** Line width in px (default 1). */
  width?: number;
}

export interface PlotMarker {
  /** X position in data units (same scale as `time`). */
  x: number;
  /** CSS color. */
  stroke: string;
  /** Line width in px (default 1). */
  width?: number;
  /** Dash pattern (default solid). */
  dash?: number[];
}

export interface PlotBand {
  /** Start of band in data units. */
  x0: number;
  /** End of band in data units. */
  x1: number;
  /** CSS fill color (typically with alpha). */
  fill: string;
}

export interface TimeSeriesPlotProps {
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
  const theme = useTheme();

  // Refs hold the latest prop values so callbacks (dblclick, Y-autofit, draw
  // hook) see them without forcing a plot rebuild when they change.
  const xMinRef = useRef(xMin);
  const xMaxRef = useRef(xMax);
  const yMinRef = useRef(yMin);
  const yMaxRef = useRef(yMax);
  const markersRef = useRef(markers);
  const bandsRef = useRef(bands);
  const segmentStrokeColorsRef = useRef(segmentStrokeColors);
  const firstSeriesStrokeWidthRef = useRef(series[0]?.width ?? 1);
  xMinRef.current = xMin;
  xMaxRef.current = xMax;
  yMinRef.current = yMin;
  yMaxRef.current = yMax;
  markersRef.current = markers;
  bandsRef.current = bands;
  segmentStrokeColorsRef.current = segmentStrokeColors;
  firstSeriesStrokeWidthRef.current = series[0]?.width ?? 1;

  const segmentStrokeDigest = fingerprintSegmentStrokeColors(segmentStrokeColors);

  // Structural signature — recreate the plot only when this string changes.
  // `theme` is included so axis / grid chrome recolors when the user toggles.
  const structureKey = [
    title ?? '',
    yLabel ?? '',
    xLabel,
    showLegend ? 'L' : '',
    height,
    series.length,
    theme,
    segmentStrokeDigest,
    ...series.map((s) => `${s.label}|${s.stroke}|${s.width ?? 1}|${(s.dash ?? []).join(',')}`),
  ].join('§');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const data: AlignedData = [time, ...series.map((s) => s.values)] as AlignedData;
    const chrome = PLOT_COLORS[theme];

    const hasSegmentStrokes =
      segmentStrokeColors != null &&
      segmentStrokeColors.length === time.length - 1 &&
      series.length >= 1;

    const opts: Options = {
      width: container.clientWidth,
      height,
      title,
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
      legend: { show: showLegend },
      cursor: {
        drag: { x: true, y: false, setScale: true },
        bind: {
          // Double-click resets to the caller-pinned bounds (or to auto if no
          // bound was specified for that side). Returning a non-null handler
          // suppresses uPlot's default reset.
          dblclick: (u) => () => {
            applyPinned(u, xMinRef.current, xMaxRef.current, yMinRef.current, yMaxRef.current);
            return null;
          },
        },
      },
      series: [
        { label: xLabel },
        ...series.map((s, idx) => {
          const strokeFirst = idx === 0 && hasSegmentStrokes;
          return {
            label: s.label,
            stroke: s.stroke,
            width: strokeFirst ? 0 : (s.width ?? 1),
            dash: s.dash,
            paths:
              strokeFirst
                ? () => null
                : undefined,
          };
        }),
      ],
      hooks: {
        drawClear: [
          (u) => {
            const bs = bandsRef.current;
            if (!bs || bs.length === 0) return;
            const ctx = u.ctx;
            const top = u.bbox.top;
            const bottom = top + u.bbox.height;
            const left = u.bbox.left;
            const right = left + u.bbox.width;
            ctx.save();
            for (const b of bs) {
              const x0 = u.valToPos(b.x0, 'x', true);
              const x1 = u.valToPos(b.x1, 'x', true);
              if (x1 < left || x0 > right) continue;
              const xa = Math.max(left, x0);
              const xb = Math.min(right, x1);
              ctx.fillStyle = b.fill;
              ctx.fillRect(xa, top, xb - xa, bottom - top);
            }
            ctx.restore();
          },
        ],
        // Set the caller-pinned bounds once data is loaded but before the first
        // paint — avoids a flash of the auto-fit range.
        ready: [
          (u) => {
            applyPinned(u, xMinRef.current, xMaxRef.current, yMinRef.current, yMaxRef.current);
          },
        ],
        setScale: [
          (u, key) => {
            // When X changes (drag-zoom), refit Y to visible samples. Skip
            // when X is at its caller-pinned range — that's the init/reset
            // path, and we want Y to stay at its pinned/auto bounds.
            if (key !== 'x') return;
            const sx = u.scales.x;
            if (!sx) return;
            const xLo = sx.min;
            const xHi = sx.max;
            if (xLo == null || xHi == null) return;
            const xData = u.data[0];
            if (!xData || xData.length === 0) return;
            const dataLo = xData[0]!;
            const dataHi = xData[xData.length - 1]!;
            const pinnedLo = xMinRef.current ?? dataLo;
            const pinnedHi = xMaxRef.current ?? dataHi;
            const span = Math.max(1e-9, pinnedHi - pinnedLo);
            const eps = span * 1e-4;
            if (Math.abs(xLo - pinnedLo) < eps && Math.abs(xHi - pinnedHi) < eps) return;

            let yLo = Infinity;
            let yHi = -Infinity;
            for (let s = 1; s < u.series.length; s++) {
              const ys = u.data[s];
              if (!ys) continue;
              for (let i = 0; i < ys.length; i++) {
                const x = xData[i];
                if (x == null || x < xLo || x > xHi) continue;
                const y = ys[i];
                if (y == null || !Number.isFinite(y)) continue;
                if (y < yLo) yLo = y;
                if (y > yHi) yHi = y;
              }
            }
            if (yLo === Infinity || yHi === -Infinity || yHi <= yLo) return;
            const pad = (yHi - yLo) * 0.06;
            u.setScale('y', { min: yLo - pad, max: yHi + pad });
          },
        ],
        draw: [
          (u) => {
            const segs = segmentStrokeColorsRef.current;
            const lineW = firstSeriesStrokeWidthRef.current;
            const xd = u.data[0];
            const yd = u.data[1];
            if (
              segs?.length &&
              xd &&
              yd &&
              segs.length === xd.length - 1 &&
              yd.length === xd.length
            ) {
              drawSegmentStrokeLine(u, segs, lineW);
            }
            const ms = markersRef.current;
            if (ms?.length) {
              const ctx = u.ctx;
              const left = u.bbox.left;
              const right = left + u.bbox.width;
              const top = u.bbox.top;
              const bottom = top + u.bbox.height;
              ctx.save();
              for (const m of ms) {
                const xPx = Math.round(u.valToPos(m.x, 'x', true)) + 0.5;
                if (xPx < left || xPx > right) continue;
                ctx.strokeStyle = m.stroke;
                ctx.lineWidth = m.width ?? 1;
                ctx.setLineDash(m.dash ?? []);
                ctx.beginPath();
                ctx.moveTo(xPx, top);
                ctx.lineTo(xPx, bottom);
                ctx.stroke();
              }
              ctx.restore();
            }
          },
        ],
      },
    };

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
  const lastDataRef = useRef<readonly (Float32Array | number[])[] | null>(null);
  useEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;
    const next: (Float32Array | number[])[] = [time, ...series.map((s) => s.values)];
    const prev = lastDataRef.current;
    if (prev && prev.length === next.length) {
      let same = true;
      for (let i = 0; i < next.length; i++) {
        if (prev[i] !== next[i]) { same = false; break; }
      }
      if (same) return;
    }
    lastDataRef.current = next;
    plot.setData(next as AlignedData, false);
  });

  // Redraw on marker / band changes (cheap — no scale reset).
  useEffect(() => {
    plotRef.current?.redraw(false);
  }, [markers, bands, segmentStrokeColors]);

  return <div ref={containerRef} className="plot" />;
}

function fingerprintSegmentStrokeColors(seg: readonly string[] | undefined): string {
  if (!seg || seg.length === 0) return '';
  let h = 2166136261 >>> 0;
  const step = Math.max(1, Math.floor(seg.length / 96));
  for (let i = 0; i < seg.length; i += step) {
    const c = seg[i]!;
    for (let k = 0; k < c.length; k++) {
      h = Math.imul(h ^ c.charCodeAt(k), 16777619) >>> 0;
    }
  }
  return `${seg.length}:${h.toString(16)}`;
}

function drawSegmentStrokeLine(u: uPlot, colors: readonly string[], lineWidth: number) {
  const xd = u.data[0];
  const yd = u.data[1];
  if (!xd || !yd || colors.length !== xd.length - 1) return;
  const ctx = u.ctx;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = lineWidth;
  ctx.setLineDash([]);
  const nSeg = colors.length;
  for (let i = 0; i < nSeg; i++) {
    const y0 = yd[i];
    const y1 = yd[i + 1];
    if (!Number.isFinite(y0 as number) || !Number.isFinite(y1 as number)) continue;

    const xA = xd[i];
    const xB = xd[i + 1];
    if (!Number.isFinite(xA as number) || !Number.isFinite(xB as number)) continue;

    ctx.strokeStyle = colors[i]!;
    ctx.beginPath();
    ctx.moveTo(u.valToPos(xA as number, 'x', true), u.valToPos(y0 as number, 'y', true));
    ctx.lineTo(u.valToPos(xB as number, 'x', true), u.valToPos(y1 as number, 'y', true));
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Push the caller's pinned bounds onto the plot. Where a side is unspecified,
 * use the current scale value (which uPlot has already auto-fit to data). This
 * is used for both initial display and dblclick-reset.
 */
function applyPinned(
  u: uPlot,
  xMin: number | undefined,
  xMax: number | undefined,
  yMin: number | undefined,
  yMax: number | undefined,
) {
  if (xMin != null || xMax != null) {
    const sx = u.scales.x;
    u.setScale('x', {
      min: xMin ?? sx?.min ?? 0,
      max: xMax ?? sx?.max ?? 0,
    });
  }
  if (yMin != null || yMax != null) {
    const sy = u.scales.y;
    u.setScale('y', {
      min: yMin ?? sy?.min ?? 0,
      max: yMax ?? sy?.max ?? 0,
    });
  }
}
