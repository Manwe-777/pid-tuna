import { MERGE_RATE_TOLERANCE } from '../../constants';

export function similarRate(a: Float32Array, b: Float32Array): boolean {
  if (a.length < 2 || b.length < 2) return false;

  return Math.abs(a[1]! / b[1]! - 1) <= MERGE_RATE_TOLERANCE;
}
