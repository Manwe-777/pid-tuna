import { type MouseEvent, useEffect, useRef } from 'react';

import { paintCrosshair } from '../plot/paintCrosshair';
import { sizeCanvas } from '../plot/sizeCanvas';
import type { PlotGeom } from '../types';
import { useElementWidth } from './useElementWidth';

type Draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => PlotGeom | null;

/**
 * A canvas plot that fills its container's width: redraws when `draw` (keep it
 * memoised), the width or the height change, and paints a crosshair with the
 * hovered values on an overlay canvas.
 */
export function useCanvasHeatmap(height: number, draw: Draw) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const geomRef = useRef<PlotGeom | null>(null);
  const width = useElementWidth(containerRef);

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    sizeCanvas(canvas, width, height, dpr);
    if (overlay) sizeCanvas(overlay, width, height, dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    geomRef.current = draw(ctx, width, height);
    if (overlay) paintCrosshair(overlay, width, height, geomRef.current, null, null);
  }, [draw, width, height]);

  const onMove = (e: MouseEvent) => {
    const overlay = overlayRef.current;
    const canvas = canvasRef.current;
    if (!overlay || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    paintCrosshair(overlay, width, height, geomRef.current, e.clientX - rect.left, e.clientY - rect.top);
  };

  const onLeave = () => {
    const overlay = overlayRef.current;
    if (overlay) paintCrosshair(overlay, width, height, geomRef.current, null, null);
  };

  return { containerRef, canvasRef, overlayRef, width, onMove, onLeave };
}
