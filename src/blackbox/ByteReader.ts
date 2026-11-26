/** Reads a blackbox byte range: bytes, variable-byte integers and fixed-width little-endian values. */
export class ByteReader {
  pos: number;
  end: number;
  /** Set once a read ran past `end`. */
  eof = false;

  constructor(
    readonly data: Uint8Array,
    start = 0,
    end = data.length,
  ) {
    this.pos = start;
    this.end = end;
  }

  /** The next byte, or -1 past the end. */
  byte(): number {
    if (this.pos < this.end) return this.data[this.pos++]!;
    this.eof = true;

    return -1;
  }

  /** The next byte without consuming it, or -1 past the end. */
  peek(): number {
    return this.pos < this.end ? this.data[this.pos]! : -1;
  }

  /** An unsigned 32-bit integer in variable-byte form; 0 when it is cut off or too long. */
  unsignedVB(): number {
    let result = 0;

    for (let i = 0, shift = 0; i < 5; i++, shift += 7) {
      const b = this.byte();
      if (b < 0) return 0;
      result |= (b & 0x7f) << shift;
      if (b < 0x80) return result >>> 0;
    }

    return 0;
  }

  /** A signed 32-bit integer in zigzag variable-byte form. */
  signedVB(): number {
    const u = this.unsignedVB();

    return (u >>> 1) ^ -(u & 1);
  }

  s8(): number {
    return (this.byte() << 24) >> 24;
  }

  s16(): number {
    const lo = this.byte();

    return ((lo | (this.byte() << 8)) << 16) >> 16;
  }

  u32(): number {
    const b0 = this.byte();
    const b1 = this.byte();
    const b2 = this.byte();

    return (b0 | (b1 << 8) | (b2 << 16) | (this.byte() << 24)) >>> 0;
  }

  /** `length` bytes as Latin-1 text. */
  text(length: number): string {
    let s = '';
    for (let i = 0; i < length; i++) s += String.fromCharCode(Math.max(0, this.byte()));

    return s;
  }
}
