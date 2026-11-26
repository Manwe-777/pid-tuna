import { useCallback } from 'react';

import { useCanvasHeatmap } from '../../hooks/useCanvasHeatmap';
import { drawErrorDensity } from '../../plot/drawErrorDensity';
import type { ErrorSetpointResult } from '../../types';

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
    <div
      className="plot"
      ref={containerRef}
      style={{ position: 'relative', padding: 0 }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <canvas ref={canvasRef} style={{ display: 'block' }} />
      <canvas ref={overlayRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
    </div>
  );
}
