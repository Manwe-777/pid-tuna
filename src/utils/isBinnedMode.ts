import type { SpectralMode } from '../types';
import { isRpmMode } from './isRpmMode';
import { isThrottleMode } from './isThrottleMode';

export const isBinnedMode = (m: SpectralMode) => isRpmMode(m) || isThrottleMode(m);
