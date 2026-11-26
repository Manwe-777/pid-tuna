import type { SpectralMode } from '../types';

export const isRpmMode = (m: SpectralMode) => m === 'freqRpm' || m === 'psdRpm';
