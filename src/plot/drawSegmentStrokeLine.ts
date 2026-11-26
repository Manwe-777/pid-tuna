import type uPlot from 'uplot';

/** Draws the first series as one line segment per colour. */
export function drawSegmentStrokeLine(u: uPlot, colors: readonly string[], lineWidth: number) {
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
