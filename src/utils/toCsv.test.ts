import { describe, expect, test } from 'vitest';

import { toCsv } from './toCsv';

describe('toCsv', () => {
  test('rows end with CRLF and plain fields stay bare', () => {
    expect(toCsv(['a', 'b'], [[1, 'x']])).toBe('a,b\r\n1,x\r\n');
  });

  test('commas, quotes and line breaks are quoted, with quotes doubled', () => {
    expect(toCsv(['v'], [['1,5'], ['say "hi"'], ['two\nlines']])).toBe(
      'v\r\n"1,5"\r\n"say ""hi"""\r\n"two\nlines"\r\n',
    );
  });

  test('missing values and non-finite numbers are empty fields', () => {
    expect(toCsv(['a', 'b', 'c', 'd'], [[null, undefined, Number.NaN, Infinity]])).toBe('a,b,c,d\r\n,,,\r\n');
  });

  test('zero is written, not treated as missing', () => {
    expect(toCsv(['a'], [[0]])).toBe('a\r\n0\r\n');
  });
});
