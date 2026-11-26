import type { ScoreEntry, ScoreStatus } from '../../types';

export function filterDelayEntry(gyroDelayMs: number, referenceHz: number, filterCount: number): ScoreEntry {
  const status: ScoreStatus = gyroDelayMs < 2.5 ? 'good' : gyroDelayMs < 5 ? 'warn' : 'bad';
  return {
    key: 'Gyro filter delay',
    status,
    value: `${gyroDelayMs.toFixed(2)} ms at ${referenceHz} Hz`,
    detail: `${filterCount} gyro filter${filterCount === 1 ? '' : 's'}`,
  };
}
