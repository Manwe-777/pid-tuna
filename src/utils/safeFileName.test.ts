import { describe, expect, test } from 'vitest';

import { safeFileName } from './safeFileName';

describe('safeFileName', () => {
  test('titles become lower-case dashed names', () => {
    expect(safeFileName('Roll — Step response (LOG00001)', 'plot')).toBe('roll-step-response-log00001');
  });

  test('path separators and reserved characters never survive', () => {
    expect(safeFileName('a/b\\c:d*e?"f<g>h|i', 'plot')).toBe('a-b-c-d-e-f-g-h-i');
  });

  test('text with nothing usable falls back', () => {
    expect(safeFileName(' — ', 'plot')).toBe('plot');
  });

  test('long titles are cut to 80 characters', () => {
    expect(safeFileName('x'.repeat(200), 'plot')).toHaveLength(80);
  });
});
