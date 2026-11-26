import type { ParsedLog, SpectrogramSource } from '../types';

/** Raw (pre-filter) or filtered gyro for one axis. */
export function gyroSignal(log: ParsedLog, source: SpectrogramSource, axis: number): Float32Array {
  return source === 'raw' ? log.gyroRaw[axis]! : log.gyroFilt[axis]!;
}
