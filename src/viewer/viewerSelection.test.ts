import { describe, expect, test } from 'vitest';

import { defaultViewerSelection } from './defaultViewerSelection';
import { parseViewerSelection } from './parseViewerSelection';
import { serializeViewerSelection } from './serializeViewerSelection';

describe('saved viewer selection', () => {
  test('a saved selection reloads as it was', () => {
    const saved = { signals: new Set(['pterm', 'motors'] as const), axes: new Set([1]), hiddenMotors: new Set([2]) };
    expect(parseViewerSelection(serializeViewerSelection(saved))).toEqual(saved);
  });

  test('nothing saved gives the Tracking preset on every axis', () => {
    expect(parseViewerSelection(null)).toEqual(defaultViewerSelection());
    expect([...defaultViewerSelection().signals].sort()).toEqual(['gyroFilt', 'setpoint']);
  });

  test('corrupt data gives the default instead of throwing', () => {
    expect(parseViewerSelection('{not json')).toEqual(defaultViewerSelection());
    expect(parseViewerSelection('null')).toEqual(defaultViewerSelection());
    expect(parseViewerSelection('42')).toEqual(defaultViewerSelection());
  });

  test('unknown signals, axes out of range and odd values are dropped', () => {
    const s = parseViewerSelection(
      JSON.stringify({ signals: ['gyroFilt', 'warp'], axes: [0, 3, -1, 1.5, '2'], hiddenMotors: 'all' }),
    );
    expect([...s.signals]).toEqual(['gyroFilt']);
    expect([...s.axes]).toEqual([0]);
    expect(s.hiddenMotors.size).toBe(0);
  });
});
