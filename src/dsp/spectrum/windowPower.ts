/** Sum of squared window weights, Σ w², used to normalise a PSD for window power. */
export function windowPower(window: Float64Array): number {
  let sum = 0;
  for (let i = 0; i < window.length; i++) sum += window[i]! * window[i]!;

  return sum;
}
