import type { SpectralValueMode } from '../dsp/spectrogram';
import type { SpectralMode } from '../types';

export const modeValueKind = (m: SpectralMode): SpectralValueMode => (m.startsWith('psd') ? 'psd' : 'magnitude');
