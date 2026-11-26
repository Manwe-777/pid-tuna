import type { StepSpectra } from './stepFrequencyResponse';

export function emptySpectra(fftSize: number, sampleTimeMs: number, regularization: number): StepSpectra {
  return {
    fftSize,
    sampleTimeMs,
    crossSpectrum: new Float64Array(fftSize * 2),
    inputPower: new Float64Array(fftSize),
    outputPower: new Float64Array(fftSize),
    regularization,
  };
}
