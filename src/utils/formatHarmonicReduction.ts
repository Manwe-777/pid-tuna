import type { HarmonicNoise } from '../types';

export function formatHarmonicReduction(raw: HarmonicNoise | undefined, filt: HarmonicNoise): string {
  if (raw?.meanDb == null || filt.meanDb == null) return '—';

  return `${(raw.meanDb - filt.meanDb).toFixed(1)} dB`;
}
