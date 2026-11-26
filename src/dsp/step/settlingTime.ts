export function settlingTime(time: Float32Array, step: Float32Array, steadyState: number): number | null {
  for (let i = step.length - 1; i >= 0; i--) {
    if (Math.abs(step[i]! / steadyState - 1) > 0.05) return i + 1 < step.length ? time[i + 1]! : null;
  }

  return time[0]!;
}
