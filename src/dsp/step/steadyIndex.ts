import { STEADY_FROM_MS } from '../../constants';

export function steadyIndex(sampleTimeMs: number, stepLen: number): number {
  return Math.min(stepLen - 1, Math.round(STEADY_FROM_MS / sampleTimeMs));
}
