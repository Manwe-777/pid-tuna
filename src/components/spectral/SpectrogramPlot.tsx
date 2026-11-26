import { useCallback, useEffect, useRef, useState } from 'react';

import { useCanvasHeatmap } from '../../hooks/useCanvasHeatmap';
import { drawPlotEvents } from '../../plot/drawPlotEvents';
import { drawSpectrogram } from '../../plot/drawSpectrogram';
import { drawTimeCursor } from '../../plot/drawTimeCursor';
import type { PlotArea, PlotEvent, SpectrogramResult } from '../../types';
import { PlotEventTargets } from '../common/PlotEventTargets';
import { PngExportButton } from '../common/PngExportButton';

interface SpectrogramPlotProps {
  data: SpectrogramResult;
  title?: string;
  /** dB floor used to scale the colormap. Default -80. */
  floorDb?: number;
  /** dB ceiling used to scale the colormap. Default 0 (peak). PSD mode passes an
   *  absolute value so the colour scale reads real power. */
  ceilDb?: number;
  /** Optional max frequency to show (Hz). Defaults to Nyquist. */
  maxFreqHz?: number;
  /** Time (s) at which to draw a vertical cursor line over the heatmap. */
  cursorTime?: number;
  /** Log events on the heatmap's time axis. */
  events?: readonly PlotEvent[];
  height?: number;
}

export function SpectrogramPlot({
  data,
  title,
  floorDb = -80,
  ceilDb = 0,
  maxFreqHz,
  cursorTime,
  events,
  height = 280,
}: SpectrogramPlotProps) {
  const [area, setArea] = useState<PlotArea | null>(null);
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, h: number) => {
      const geom = drawSpectrogram(ctx, width, h, data, { title, floorDb, ceilDb, maxFreqHz });
      const next = geom && {
        left: geom.left,
        top: geom.top,
        width: geom.plotW,
        height: geom.plotH,
        xMin: geom.xMin,
        xMax: geom.xMax,
      };
      if (next) drawPlotEvents(ctx, events, next, 1, edgeSlack(data));
      setArea(next);

      return geom;
    },
    [data, title, floorDb, ceilDb, maxFreqHz, events],
  );
  const { containerRef, canvasRef, overlayRef, width, onMove, onLeave } = useCanvasHeatmap(height, draw);
  const cursorCanvasRef = useRef<HTMLCanvasElement>(null);

  // Cursor: separate canvas overlay so slider scrubbing doesn't redraw the heatmap.
  useEffect(() => {
    if (cursorCanvasRef.current) drawTimeCursor(cursorCanvasRef.current, width, height, data, cursorTime);
  }, [cursorTime, data, width, height]);

  return (
    <div className="plot group relative p-0" ref={containerRef} onMouseMove={onMove} onMouseLeave={onLeave}>
      <canvas className="block" ref={canvasRef} />
      <PngExportButton
        canvases={() => (canvasRef.current ? [canvasRef.current] : [])}
        backgroundOf={() => containerRef.current}
        fallbackName={`spectrogram ${title ?? ''}`}
      />
      <canvas className="pointer-events-none absolute inset-0" ref={cursorCanvasRef} />
      <canvas className="pointer-events-none absolute inset-0" ref={overlayRef} />
      {events?.length && area ? <PlotEventTargets events={events} area={area} slack={edgeSlack(data)} /> : null}
    </div>
  );
}

/** The first and last columns are window centres; each window reaches this far past its centre. */
function edgeSlack(data: SpectrogramResult): number {
  return data.halfWindowSec;
}
