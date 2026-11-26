import type { ScoreEntry, ScoreStatus } from '../../types';

export function noiseFloorEntry(psds: { frequencies: Float32Array; psdDb: Float32Array }[]): ScoreEntry | null {
  let sum = 0;
  let n = 0;

  for (const p of psds) {
    for (let i = 0; i < p.frequencies.length; i++) {
      const f = p.frequencies[i]!;
      if (f < 100 || f >= 300) continue;
      sum += p.psdDb[i]!;
      n++;
    }
  }

  const midBandMean = n > 0 ? sum / n : Number.NaN;
  if (!Number.isFinite(midBandMean)) return null;
  const status: ScoreStatus = midBandMean < 5 ? 'good' : midBandMean < 15 ? 'warn' : 'bad';
  return {
    key: 'Noise floor (100-300 Hz)',
    status,
    value: `${midBandMean.toFixed(1)} dB mean`,
    detail: 'Filtered gyro across roll/pitch/yaw',
  };
}
