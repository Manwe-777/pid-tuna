import type { StepSpectra } from '../../types';

export function addSpectra(into: StepSpectra, from: StepSpectra): void {
  for (let i = 0; i < into.crossSpectrum.length; i++)
    into.crossSpectrum[i] = into.crossSpectrum[i]! + from.crossSpectrum[i]!;

  for (let i = 0; i < into.fftSize; i++) {
    into.inputPower[i] = into.inputPower[i]! + from.inputPower[i]!;
    into.outputPower[i] = into.outputPower[i]! + from.outputPower[i]!;
  }
}
