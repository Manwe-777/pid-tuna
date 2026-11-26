import { BF_FEATURES } from '../constants';

/** Names of the bits set in a `features` header value; unknown bits as "BIT_n". */
export function featureNames(mask: number): string[] {
  const names: string[] = [];
  for (let bit = 0; bit < 32; bit++) if ((mask >>> bit) & 1) names.push(BF_FEATURES[bit] ?? `BIT_${bit}`);

  return names;
}
