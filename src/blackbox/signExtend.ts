/** The low `bits` bits of `value` read as a two's-complement signed number. */
export function signExtend(value: number, bits: number): number {
  const shift = 32 - bits;

  return (value << shift) >> shift;
}
