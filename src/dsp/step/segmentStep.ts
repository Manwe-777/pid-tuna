import { SEGMENT_REGULARIZATION } from '../../constants';
import type { StepFftContext } from '../../types';
import { accumulateSpectra } from './accumulateSpectra';
import { deconvolve } from './deconvolve';
import { emptyStepSpectra } from './emptyStepSpectra';
import { relativeLambda } from './relativeLambda';

export function segmentStep(ctx: StepFftContext, stepLen: number): Float32Array {
  const s = emptyStepSpectra(ctx.fftSize, 0, SEGMENT_REGULARIZATION);
  accumulateSpectra(ctx, s);

  return deconvolve(ctx, s.crossSpectrum, s.inputPower, relativeLambda(s.inputPower, SEGMENT_REGULARIZATION), stepLen);
}
