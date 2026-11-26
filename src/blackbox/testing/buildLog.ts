/** Builds blackbox bytes for tests, following Betaflight's encoder. */

/** Unsigned variable-byte encoding. */
export function uvb(value: number): number[] {
  const out: number[] = [];
  let v = value >>> 0;

  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }

  out.push(v);

  return out;
}

/** Signed (zigzag) variable-byte encoding. */
export function svb(value: number): number[] {
  return uvb(((value << 1) ^ (value >> 31)) >>> 0);
}

/** Header lines, each as `H name:value\n`. */
export function headerBytes(lines: ReadonlyArray<[string, string]>): number[] {
  return ascii(lines.map(([k, v]) => `H ${k}:${v}\n`).join(''));
}

export function ascii(text: string): number[] {
  return Array.from(text, (c) => c.charCodeAt(0));
}

/** A frame: its marker letter, then its bytes. */
export function frame(marker: string, ...parts: number[][]): number[] {
  return [marker.charCodeAt(0), ...parts.flat()];
}
