import type { SpectralValueMode } from '../types';

/** Colour-scale bounds: PSD uses the user's overrides else the auto range; magnitude is fixed at -80…0 dB. */
export function spectralDbRange(
  valueMode: SpectralValueMode,
  auto: { floor: number; ceil: number },
  dbMin: number | null,
  dbMax: number | null,
): { floorDb: number; ceilDb: number } {
  if (valueMode !== 'psd') return { floorDb: -80, ceilDb: 0 };

  return { floorDb: dbMin ?? auto.floor, ceilDb: dbMax ?? auto.ceil };
}
