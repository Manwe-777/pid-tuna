export const STEADY_FROM_MS = 200;

export function steadyIndex(sampleTimeMs: number, stepLen: number): number {
  return Math.min(stepLen - 1, Math.round(STEADY_FROM_MS / sampleTimeMs));
}
