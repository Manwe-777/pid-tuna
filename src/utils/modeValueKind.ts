import type { SpectralMode, SpectralValueMode } from '../types';

export const modeValueKind = (m: SpectralMode): SpectralValueMode => (m.startsWith('psd') ? 'psd' : 'magnitude');
