export function relativeLambda(power: Float64Array, regularization: number): number {
  let sum = 0;
  for (let k = 0; k < power.length; k++) sum += power[k]!;

  return (regularization * sum) / power.length;
}
