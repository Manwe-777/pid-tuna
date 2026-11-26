import type { StepFftContext } from '../../types';
import { createFft } from '../../utils/createFft';
import { makeHannWindow } from '../../utils/makeHannWindow';

export function makeStepFftContext(fftSize: number, winSamples: number): StepFftContext {
  return {
    fft: createFft(fftSize),
    fftSize,
    winSamples,
    hann: makeHannWindow(winSamples),
    xPad: new Float64Array(fftSize),
    yPad: new Float64Array(fftSize),
    X: new Float64Array(fftSize * 2),
    Y: new Float64Array(fftSize * 2),
    H: new Float64Array(fftSize * 2),
    h: new Float64Array(fftSize * 2),
  };
}
