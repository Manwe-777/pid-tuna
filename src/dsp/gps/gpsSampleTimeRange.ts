/** First and last sample time, 0 when there are none. */
export function gpsSampleTimeRange(samples: ReadonlyArray<{ t: number }>): { tMin: number; tMax: number } {
  return { tMin: samples[0]?.t ?? 0, tMax: samples[samples.length - 1]?.t ?? 0 };
}
