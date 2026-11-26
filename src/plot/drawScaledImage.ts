import type { PlotMargin } from '../types';

/** Draws bin-resolution pixels stretched over the plot area, smoothed. */
export function drawScaledImage(
  ctx: CanvasRenderingContext2D,
  img: ImageData,
  m: PlotMargin,
  plotW: number,
  plotH: number,
  quality: ImageSmoothingQuality,
) {
  const off = document.createElement('canvas');
  off.width = img.width;
  off.height = img.height;
  off.getContext('2d')!.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = quality;
  ctx.drawImage(off, m.left, m.top, plotW, plotH);
}
