import { AXIS_NAMES, RATED_AXES } from '../../constants';
import type { LatencyResult, ScoreEntry, ScoreStatus } from '../../types';

export function latencyEntry(latencies: LatencyResult[]): ScoreEntry {
  const reliable = RATED_AXES.map((i) => latencies[i]!).filter((l) => l.reliable);
  if (reliable.length === 0) {
    return {
      key: 'Tracking latency',
      status: 'na',
      value: '—',
      detail: 'No stick activity in the window',
    };
  }
  const max = Math.max(...reliable.map((l) => l.lagMs));
  const status: ScoreStatus = max < 25 ? 'good' : max < 45 ? 'warn' : 'bad';
  return {
    key: 'Tracking latency',
    status,
    value:
      RATED_AXES.map((i) => `${AXIS_NAMES[i]} ${latencies[i]!.reliable ? latencies[i]!.lagMs.toFixed(1) : '—'}`).join(
        ' · ',
      ) + ' ms',
    detail: 'Setpoint → gyro delay (cross-correlation)',
  };
}
