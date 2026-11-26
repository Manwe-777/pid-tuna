import type { SpectralMode } from '../types';

export const isThrottleMode = (m: SpectralMode) => m === 'freqThrottle' || m === 'psdThrottle';
