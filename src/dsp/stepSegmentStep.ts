import type { StepFftContext } from '../types';
import { accumulate } from './accumulateStepSpectra';
import { emptySpectra } from './emptyStepSpectra';
import { deconvolve } from './stepDeconvolve';
import { relativeLambda } from './stepFrequencyResponse';

/** Per-window traces are only for screening and display, so they use a steadier, stronger λ. */
export const SEGMENT_REGULARIZATION = 0.01;

export function segmentStep(ctx: StepFftContext, stepLen: number): Float32Array {
  const s = emptySpectra(ctx.fftSize, 0, SEGMENT_REGULARIZATION);
  accumulate(ctx, s);

  return deconvolve(ctx, s.crossSpectrum, s.inputPower, relativeLambda(s.inputPower, SEGMENT_REGULARIZATION), stepLen);
}
