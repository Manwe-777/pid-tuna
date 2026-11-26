import { describe, expect, test } from 'vitest';

import type { ParsedLog } from '../types';
import { LogLibrary } from './LogLibrary';

const log = (fileName: string) => ({ fileName }) as unknown as ParsedLog;

function libraryWith(...ids: string[]): LogLibrary {
  const lib = new LogLibrary();

  for (const id of ids) {
    lib.add(id, `${id}.bbl`);
    lib.setReady(id, log(`${id}.bbl`));
  }

  return lib;
}

describe('LogLibrary', () => {
  test('a new log starts parsing, enabled, with the next line style', () => {
    const lib = libraryWith('a');
    lib.add('b', 'b.bbl');

    expect(lib.slots[1]).toMatchObject({
      id: 'b',
      enabled: true,
      dashIndex: 1,
      state: { kind: 'parsing', progress: 0 },
    });
  });

  test('only ready, enabled logs are plotted', () => {
    const lib = libraryWith('a', 'b', 'c');
    lib.toggle('b');
    lib.add('d', 'd.bbl');
    lib.add('e', 'e.bbl');
    lib.setError('e', 'e.bbl', 'bad header');

    expect(lib.enabled.map((e) => e.slot.id)).toEqual(['a', 'c']);
  });

  test('toggling twice turns a log back on', () => {
    const lib = libraryWith('a');
    lib.toggle('a');
    lib.toggle('a');

    expect(lib.enabled).toHaveLength(1);
  });

  test('progress for a log removed while parsing is ignored', () => {
    const lib = new LogLibrary();
    lib.add('a', 'a.bbl');
    lib.remove('a');
    lib.setProgress('a', 'a.bbl', 0.5, 1000);
    lib.setReady('a', log('a.bbl'));

    expect(lib.slots).toHaveLength(0);
  });

  test('reordering moves a log to the other one’s position', () => {
    const lib = libraryWith('a', 'b', 'c');
    lib.reorder('c', 'a');

    expect(lib.slots.map((s) => s.id)).toEqual(['c', 'a', 'b']);
  });

  test('reordering with an unknown id or onto itself keeps the order', () => {
    const lib = libraryWith('a', 'b');
    lib.reorder('a', 'zz');
    lib.reorder('b', 'b');

    expect(lib.slots.map((s) => s.id)).toEqual(['a', 'b']);
  });

  test('changing a clone leaves the original untouched', () => {
    const lib = libraryWith('a');
    const next = lib.clone();
    next.toggle('a');
    next.add('b', 'b.bbl');

    expect(lib.slots).toHaveLength(1);
    expect(lib.slots[0]!.enabled).toBe(true);
  });
});
