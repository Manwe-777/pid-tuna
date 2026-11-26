import type { StepFftContext } from '../types';
import type { StepSpectra } from './stepFrequencyResponse';

export function accumulate(ctx: StepFftContext, s: StepSpectra): void {
  const { X, Y } = ctx;

  for (let k = 0; k < ctx.fftSize; k++) {
    const xr = X[2 * k]!;
    const xi = X[2 * k + 1]!;
    const yr = Y[2 * k]!;
    const yi = Y[2 * k + 1]!;
    s.crossSpectrum[2 * k] = s.crossSpectrum[2 * k]! + yr * xr + yi * xi;
    s.crossSpectrum[2 * k + 1] = s.crossSpectrum[2 * k + 1]! + yi * xr - yr * xi;
    s.inputPower[k] = s.inputPower[k]! + xr * xr + xi * xi;
    s.outputPower[k] = s.outputPower[k]! + yr * yr + yi * yi;
  }
}
