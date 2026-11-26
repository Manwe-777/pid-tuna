import type { SpectralMode } from '../types';

export const isTimeMode = (m: SpectralMode) => m === 'freqTime' || m === 'psdTime';
