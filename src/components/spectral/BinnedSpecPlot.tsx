import { useCallback } from 'react';

import { useCanvasHeatmap } from '../../hooks/useCanvasHeatmap';
import { drawBinnedSpectrogram } from '../../plot/drawBinnedSpectrogram';
import type { BinnedSpectrogramResult } from '../../types';
import { PngExportButton } from '../common/PngExportButton';

interface BinnedSpecPlotProps {
  data: BinnedSpectrogramResult;
  /** Y-axis (domain) label, e.g. "throttle %" or "motor freq (Hz)". */
  yLabel: string;
  title?: string;
  /** Optional maximum frequency (Hz) to display on the X axis. */
  maxFreqHz?: number;
  /** Colour-scale bottom in dB (default -80). */
  dbFloor?: number;
  /** Colour-scale top in dB (default 0). */
  dbCeil?: number;
  /** Colorbar unit label (e.g. "dB" or "dBm/Hz"). */
  valueUnit?: string;
  height?: number;
}

/**
 * Blackbox-Explorer-style binned heatmap: frequency along the X axis, an
 * arbitrary binned domain (throttle % or motor frequency) up the Y axis,
 * coloured by the gyro spectrum. Dark by design — viridis reads on a dark
 * ground, so this stays dark in both app themes.
 */
export function BinnedSpecPlot({
  data,
  yLabel,
  title,
  maxFreqHz,
  dbFloor = -80,
  dbCeil = 0,
  valueUnit = 'dB',
  height = 460,
}: BinnedSpecPlotProps) {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, h: number) =>
      drawBinnedSpectrogram(ctx, width, h, data, { title, yLabel, maxFreqHz, dbFloor, dbCeil, valueUnit }),
    [data, title, yLabel, maxFreqHz, dbFloor, dbCeil, valueUnit],
  );
  const { containerRef, canvasRef, overlayRef, onMove, onLeave } = useCanvasHeatmap(height, draw);

  return (
    <div className="plot group relative p-0" ref={containerRef} onMouseMove={onMove} onMouseLeave={onLeave}>
      <canvas className="block" ref={canvasRef} />
      <PngExportButton
        canvases={() => (canvasRef.current ? [canvasRef.current] : [])}
        backgroundOf={() => containerRef.current}
        fallbackName={`${yLabel} spectrum ${title ?? ''}`}
      />
      <canvas className="pointer-events-none absolute inset-0" ref={overlayRef} />
    </div>
  );
}
