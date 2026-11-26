export function firstCrossing(time: Float32Array, signal: Float32Array, target: number): number | null {
  for (let i = 1; i < signal.length; i++) {
    const a = signal[i - 1]!;
    const b = signal[i]!;

    if (a < target && b >= target) {
      const frac = (target - a) / (b - a);

      return time[i - 1]! + frac * (time[i]! - time[i - 1]!);
    }
  }

  return null;
}
