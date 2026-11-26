/** Betaflight's `filterGetNotchQ`: Q from a notch's centre and lower cutoff. */
export function notchQFromCutoff(centerHz: number, cutoffHz: number): number {
  return (centerHz * cutoffHz) / (centerHz * centerHz - cutoffHz * cutoffHz);
}
