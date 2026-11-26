import type { StepSpectra } from '../../types';
import { deconvolve } from './deconvolve';
import { makeStepFftContext } from './makeStepFftContext';
import { relativeLambda } from './relativeLambda';

export function stepFromSpectra(s: StepSpectra, stepLen: number): Float32Array {
  const ctx = makeStepFftContext(s.fftSize, 0);

  return deconvolve(ctx, s.crossSpectrum, s.inputPower, relativeLambda(s.inputPower, s.regularization), stepLen);
}
