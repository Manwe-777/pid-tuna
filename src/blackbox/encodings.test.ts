import { describe, expect, test } from 'vitest';

import { ByteReader } from './ByteReader';
import { readTag2_3S32 } from './readTag2_3S32';
import { readTag2_3SVariable } from './readTag2_3SVariable';
import { readTag8_4S16 } from './readTag8_4S16';
import { readTag8_8SVB } from './readTag8_8SVB';
import { svb, uvb } from './testing/buildLog';

const reader = (bytes: number[]) => new ByteReader(Uint8Array.from(bytes));

const fits = (values: number[], limits: number[]) => values.every((v, i) => v >= -limits[i]! && v < limits[i]!);

/** Betaflight's blackboxWriteTag2_3SVariable, for checking the decoder against. */
function encodeTag2_3SVariable(v: [number, number, number]): number[] {
  const [a, b, c] = v;
  if (fits(v, [2, 2, 2])) return [((a & 3) << 4) | ((b & 3) << 2) | (c & 3)];

  if (fits(v, [16, 16, 8])) {
    return [(1 << 6) | ((a & 0x1f) << 1) | ((b & 0x1f) >> 4), ((b & 0x0f) << 4) | (c & 0x0f)];
  }

  return [(2 << 6) | ((a & 0xff) >> 2), ((a & 0x03) << 6) | ((b & 0x7f) >> 1), ((b & 0x01) << 7) | (c & 0x7f)];
}

describe('variable-byte integers', () => {
  test('values round-trip through the encoding, including large and negative ones', () => {
    for (const v of [0, 1, 127, 128, 300, 2 ** 31 - 1, 2 ** 32 - 1]) expect(reader(uvb(v)).unsignedVB()).toBe(v);
    for (const v of [0, -1, 1, -64, 63, -300, 2 ** 31 - 1, -(2 ** 31)]) expect(reader(svb(v)).signedVB()).toBe(v);
  });

  test('a number cut off by the end of the data reads as 0 and flags the end', () => {
    const r = reader([0x80, 0x80]);
    expect(r.unsignedVB()).toBe(0);
    expect(r.eof).toBe(true);
  });
});

describe('tag2_3S32', () => {
  test('small values share one byte, 2 bits each', () => {
    const v: number[] = [];
    readTag2_3S32(reader([0b00_01_11_10]), v);
    expect(v).toEqual([1, -1, -2]);
  });

  test('4-bit and 6-bit layouts', () => {
    const v: number[] = [];
    readTag2_3S32(reader([0b01_00_0111, 0b1000_0001]), v);
    expect(v).toEqual([7, -8, 1]);
    readTag2_3S32(reader([0b10_011111, 0b100000, 0b000001]), v);
    expect(v).toEqual([31, -32, 1]);
  });

  test('wide values use 1 to 4 bytes each, sizes in the tag', () => {
    const v: number[] = [];
    // Sizes 1, 2 and 4 bytes, first value in the low bits of the tag.
    readTag2_3S32(reader([0b11_11_01_00, 0xff, 0x34, 0x12, 0x00, 0x00, 0x00, 0x80]), v);
    expect(v).toEqual([-1, 0x1234, -(2 ** 31)]);
  });
});

describe('tag2_3SVariable', () => {
  test('decodes what Betaflight encodes in each of its packings', () => {
    // The widest packing holds 8, 7 and 7 bits; those are its edges.
    const cases: Array<[number, number, number]> = [
      [1, -2, 0],
      [15, -16, 7],
      [-16, 3, -8],
      [127, -64, 63],
      [-128, 63, -64],
    ];

    for (const c of cases) {
      const v: number[] = [];
      readTag2_3SVariable(reader(encodeTag2_3SVariable(c)), v);
      expect(v).toEqual(c);
    }
  });
});

describe('tag8_4S16', () => {
  test('data version 2 packs nibbles, bytes and words nibble-aligned and big-endian', () => {
    const v: number[] = [];
    // Sizes: 4-bit, 8-bit, 16-bit, 0 → selector 0b00_11_10_01.
    // Values 5, -2 (0xFE), 0x1234: 5 | F E | 1 2 3 4 | pad.
    readTag8_4S16(reader([0b00_11_10_01, 0x5f, 0xe1, 0x23, 0x40]), v, 2);
    expect(v).toEqual([5, -2, 0x1234, 0]);
  });

  test('two nibbles fill one byte', () => {
    const v: number[] = [];
    readTag8_4S16(reader([0b01_01_00_00, 0x7f]), v, 2);
    expect(v).toEqual([0, 0, 7, -1]);
  });

  test('data version 1 is byte-aligned and little-endian', () => {
    const v: number[] = [];
    readTag8_4S16(reader([0b11_10_01_01 /* pairs of nibbles first */, 0xf3, 0x80, 0x34, 0x12]), v, 1);
    expect(v).toEqual([3, -1, -128, 0x1234]);
  });
});

describe('tag8_8SVB', () => {
  test('a header byte marks which of up to eight values are non-zero', () => {
    const v: number[] = [];
    readTag8_8SVB(reader([0b0000_0101, ...svb(-3), ...svb(200)]), v, 3);
    expect(v.slice(0, 3)).toEqual([-3, 0, 200]);
  });

  test('a group of one has no header byte', () => {
    const v: number[] = [];
    readTag8_8SVB(reader(svb(-9)), v, 1);
    expect(v[0]).toBe(-9);
  });
});
