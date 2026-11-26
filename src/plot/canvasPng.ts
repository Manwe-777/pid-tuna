/**
 * The canvases stacked into one PNG at device resolution, over a solid
 * background (uPlot leaves its plot area transparent).
 */
export function canvasPng(canvases: HTMLCanvasElement[], background: string): Promise<Blob | null> {
  const first = canvases[0];
  if (!first) return Promise.resolve(null);

  const out = document.createElement('canvas');
  out.width = first.width;
  out.height = first.height;
  const ctx = out.getContext('2d');
  if (!ctx) return Promise.resolve(null);

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, out.width, out.height);
  for (const c of canvases) ctx.drawImage(c, 0, 0);

  return new Promise((resolve) => out.toBlob(resolve, 'image/png'));
}
