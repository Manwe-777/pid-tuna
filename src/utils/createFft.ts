import FFT from 'fft.js';

import type { FftImpl } from '../types';

/** A radix-4 FFT of the given power-of-two size. */
export function createFft(size: number): FftImpl {
  return new (FFT as unknown as new (n: number) => FftImpl)(size);
}
