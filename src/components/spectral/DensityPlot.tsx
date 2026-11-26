import { useCallback } from 'react';

import { useCanvasHeatmap } from '../../hooks/useCanvasHeatmap';
import { drawErrorDensity } from '../../plot/drawErrorDensity';
import type { ErrorSetpointResult } from '../../types';
import { PngExportButton } from '../common/PngExportButton';

interface DensityPlotProps {
  data: ErrorSetpointResult;
  title?: string;
  xLabel?: string;
  yLabel?: string;
  height?: number;
}

/**
 * 2D density heatmap for "Error vs Setpoint": X = setpoint (deg/s), Y = error
 * (deg/s), colour = log sample density (viridis). Reference lines at error = 0
 * (ideal tracking) and setpoint = 0. Dark by design, like the other heatmaps.
 */
export function DensityPlot({
  data,
  title,
  xLabel = 'setpoint (deg/s)',
  yLabel = 'error (deg/s)',
  height = 300,
}: DensityPlotProps) {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, h: number) =>
      drawErrorDensity(ctx, width, h, data, { title, xLabel, yLabel }),
    [data, title, xLabel, yLabel],
  );
  const { containerRef, canvasRef, overlayRef, onMove, onLeave } = useCanvasHeatmap(height, draw);

  return (
    <div className="plot group relative p-0" ref={containerRef} onMouseMove={onMove} onMouseLeave={onLeave}>
      <canvas className="block" ref={canvasRef} />
      <PngExportButton
        canvases={() => (canvasRef.current ? [canvasRef.current] : [])}
        backgroundOf={() => containerRef.current}
        fallbackName={`error vs setpoint ${title ?? ''}`}
      />
      <canvas className="pointer-events-none absolute inset-0" ref={overlayRef} />
    </div>
  );
}
