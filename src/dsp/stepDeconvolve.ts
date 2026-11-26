import type { StepFftContext } from '../types';

export function deconvolve(
  ctx: StepFftContext,
  cross: Float64Array,
  power: Float64Array,
  lambda: number,
  stepLen: number,
): Float32Array {
  const N = ctx.fftSize;

  for (let k = 0; k < N; k++) {
    const den = power[k]! + lambda;
    ctx.H[2 * k] = den > 0 ? cross[2 * k]! / den : 0;
    ctx.H[2 * k + 1] = den > 0 ? cross[2 * k + 1]! / den : 0;
  }

  ctx.fft.inverseTransform(ctx.h, ctx.H);

  const step = new Float32Array(stepLen);
  let acc = 0;

  for (let i = 0; i < stepLen; i++) {
    acc += ctx.h[2 * i]!;
    step[i] = acc;
  }

  return step;
}
