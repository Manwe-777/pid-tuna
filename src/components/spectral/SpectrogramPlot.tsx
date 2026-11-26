import { useCallback, useEffect, useRef } from 'react';

import { useCanvasHeatmap } from '../../hooks/useCanvasHeatmap';
import { drawSpectrogram } from '../../plot/drawSpectrogram';
import { drawTimeCursor } from '../../plot/drawTimeCursor';
import type { SpectrogramResult } from '../../types';

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
  height?: number;
}

export function SpectrogramPlot({
  data,
  title,
  floorDb = -80,
  ceilDb = 0,
  maxFreqHz,
  cursorTime,
  height = 280,
}: SpectrogramPlotProps) {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, h: number) =>
      drawSpectrogram(ctx, width, h, data, { title, floorDb, ceilDb, maxFreqHz }),
    [data, title, floorDb, ceilDb, maxFreqHz],
  );
  const { containerRef, canvasRef, overlayRef, width, onMove, onLeave } = useCanvasHeatmap(height, draw);
  const cursorCanvasRef = useRef<HTMLCanvasElement>(null);

  // Cursor: separate canvas overlay so slider scrubbing doesn't redraw the heatmap.
  useEffect(() => {
    if (cursorCanvasRef.current) drawTimeCursor(cursorCanvasRef.current, width, height, data, cursorTime);
  }, [cursorTime, data, width, height]);

  return (
    <div className="plot relative p-0" ref={containerRef} onMouseMove={onMove} onMouseLeave={onLeave}>
      <canvas className="block" ref={canvasRef} />
      <canvas className="pointer-events-none absolute inset-0" ref={cursorCanvasRef} />
      <canvas className="pointer-events-none absolute inset-0" ref={overlayRef} />
    </div>
  );
}
