import type { HarmonicNoise } from '../types';

export function formatHarmonicLevel(h: HarmonicNoise): string {
  return h.meanDb == null ? '—' : `${h.meanDb.toFixed(1)} ± ${h.sdDb!.toFixed(1)} dB`;
}
