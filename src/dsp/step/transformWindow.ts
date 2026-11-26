import type { StepFftContext } from '../../types';

export function transformWindow(ctx: StepFftContext, setpoint: Float32Array, gyro: Float32Array, start: number): void {
  ctx.xPad.fill(0);
  ctx.yPad.fill(0);

  for (let i = 0; i < ctx.winSamples; i++) {
    const w = ctx.hann[i]!;
    ctx.xPad[i] = setpoint[start + i]! * w;
    ctx.yPad[i] = gyro[start + i]! * w;
  }

  ctx.fft.realTransform(ctx.X, ctx.xPad);
  ctx.fft.completeSpectrum(ctx.X);
  ctx.fft.realTransform(ctx.Y, ctx.yPad);
  ctx.fft.completeSpectrum(ctx.Y);
}
