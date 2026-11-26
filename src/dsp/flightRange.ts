/** Throttle (stick %) that counts as flying. */
const AIRBORNE_PCT = 20;
/** How long throttle must stay above it to count as a takeoff (or, read backwards, a landing). */
const SUSTAIN_SEC = 0.5;

/**
 * Sample range from takeoff to landing: from the first time stick throttle
 * stays above 20% for half a second to the last time it does. Everything in
 * between counts as flight, including throttle cuts for flips and rolls.
 * Null if the log never takes off.
 */
export function flightRange(throttlePct: Float32Array, sampleRateHz: number): { start: number; end: number } | null {
  const sustain = Math.max(1, Math.round(SUSTAIN_SEC * sampleRateHz));
  const start = firstSustained(throttlePct, sustain, 1);
  if (start == null) return null;

  const end = firstSustained(throttlePct, sustain, -1)!;

  return end > start ? { start, end } : null;
}

/** First index (scanning forwards, or backwards when step = −1) where throttle stays airborne for `sustain` samples. */
function firstSustained(t: Float32Array, sustain: number, step: 1 | -1): number | null {
  let run = 0;

  for (let k = 0; k < t.length; k++) {
    const i = step === 1 ? k : t.length - 1 - k;
    run = t[i]! >= AIRBORNE_PCT ? run + 1 : 0;
    if (run >= sustain) return step === 1 ? i - sustain + 1 : i + sustain - 1;
  }

  return null;
}
