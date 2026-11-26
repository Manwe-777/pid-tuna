import { describe, expect, test } from 'vitest';

import type { DataPresence, LogEntry, ParsedLog, ViewerSelection, ViewerSignalKey } from '../types';
import { matchingPreset } from './matchingPreset';
import { viewerLanes } from './viewerLanes';

const N = 4;
const ALL: DataPresence = {
  gyroRaw: true,
  pidTerms: true,
  iTerm: true,
  motors: true,
  eRpm: true,
  vbat: false,
  amperage: false,
  gps: false,
} as DataPresence;

const arr = (v: number, n = N) => new Float32Array(n).fill(v);
const axes3 = (v: number, n = N) => [arr(v, n), arr(v, n), arr(v, n)];

function entry(name: string, presence: Partial<DataPresence> = {}, n = N, dashIndex = 0): LogEntry {
  const log = {
    fileName: `${name}.BFL`,
    logIndex: 0,
    logCount: 1,
    time: arr(0, n),
    gyroFilt: axes3(1, n),
    gyroRaw: axes3(2, n),
    setpoint: axes3(3, n),
    pTerm: axes3(4, n),
    iTerm: axes3(5, n),
    dTerm: [arr(6, n), arr(6, n)],
    fTerm: axes3(7, n),
    rcCommand: [arr(0, n), arr(0, n), arr(0, n), arr(1500, n)],
    motor: [arr(1, n), arr(2, n), arr(3, n), arr(4, n)],
    eRpm: [arr(10, n), arr(20, n), arr(30, n), arr(40, n)],
    presence: { ...ALL, ...presence },
  } as unknown as ParsedLog;
  const slot = { id: name, dashIndex, state: { kind: 'ready', log } } as unknown as LogEntry['slot'];

  return { slot, log, dash: dashIndex === 0 ? [] : [4, 4] };
}

function sel(signals: ViewerSignalKey[], axes = [0, 1, 2], hiddenMotors: number[] = []): ViewerSelection {
  return { signals: new Set(signals), axes: new Set(axes), hiddenMotors: new Set(hiddenMotors) };
}

const titles = (lanes: ReturnType<typeof viewerLanes>) => lanes.map((l) => l.title);
const labels = (lane: ReturnType<typeof viewerLanes>[number] | undefined) => lane?.series.map((s) => s.label);

describe('viewerLanes', () => {
  test('per-axis signals share one lane per chosen axis, power signals get their own lanes', () => {
    const lanes = viewerLanes([entry('A')], sel(['setpoint', 'gyroFilt', 'throttle', 'motors'], [0, 2]));
    expect(titles(lanes)).toEqual(['Roll', 'Yaw', 'Throttle', 'Motors']);
    expect(labels(lanes[0])).toEqual(['Setpoint', 'Gyro']);
  });

  test('no per-axis signal chosen means no axis lanes, whatever axes are on', () => {
    expect(titles(viewerLanes([entry('A')], sel(['throttle'])))).toEqual(['Throttle']);
  });

  test('signals are drawn in a fixed order so prefilt gyro stays behind the filtered one', () => {
    const lanes = viewerLanes([entry('A')], sel(['gyroFilt', 'gyroRaw'], [0]));
    expect(labels(lanes[0])).toEqual(['Gyro prefilt', 'Gyro']);
  });

  test('the filtered gyro takes the axis colour', () => {
    const [roll, pitch] = viewerLanes([entry('A')], sel(['gyroFilt'], [0, 1]));
    expect(roll?.series[0]?.stroke).toBe(roll?.dot);
    expect(pitch?.series[0]?.stroke).toBe(pitch?.dot);
    expect(roll?.dot).not.toBe(pitch?.dot);
  });

  test('a signal no log has is left out', () => {
    const lanes = viewerLanes([entry('A', { gyroRaw: false, eRpm: false })], sel(['gyroRaw', 'gyroFilt', 'eRpm']));
    expect(labels(lanes[0])).toEqual(['Gyro']);
    expect(titles(lanes)).not.toContain('eRPM');
  });

  test('yaw has no D term, so its lane has only the other terms', () => {
    const lanes = viewerLanes([entry('A')], sel(['pterm', 'dterm']));
    expect(labels(lanes[0])).toEqual(['P', 'D']);
    expect(labels(lanes[2])).toEqual(['P']);
  });

  test('the y label lists each unit in the lane once', () => {
    expect(viewerLanes([entry('A')], sel(['setpoint', 'gyroFilt'], [0]))[0]?.yLabel).toBe('deg/s');
    expect(viewerLanes([entry('A')], sel(['gyroFilt', 'pterm', 'iterm'], [0]))[0]?.yLabel).toBe('deg/s · output');
  });

  test('hidden motors are left out of the motor and eRPM lanes', () => {
    const lanes = viewerLanes([entry('A')], sel(['motors', 'eRpm'], [], [1, 3]));
    expect(labels(lanes[0])).toEqual(['M1', 'M3']);
    expect(labels(lanes[1])).toEqual(['M1', 'M3']);
  });

  test('with one motor shown the lane title names it', () => {
    expect(viewerLanes([entry('A')], sel(['motors'], [], [0, 1, 3]))[0]?.title).toBe('Motors — M3');
  });

  describe('several logs', () => {
    const logs = [entry('A'), entry('B', {}, N, 1)];

    test('a signal alone in its lane is drawn once per log in log colours, named by log', () => {
      const [roll] = viewerLanes(logs, sel(['gyroFilt'], [0]));
      expect(labels(roll)).toEqual(['A', 'B']);
      expect(roll?.series[0]?.stroke).not.toBe(roll?.series[1]?.stroke);
      expect(roll?.series.every((s) => s.dash === undefined)).toBe(true);
    });

    test('several signals keep their colours and tell logs apart by dash and name', () => {
      const [roll] = viewerLanes(logs, sel(['setpoint', 'gyroFilt'], [0]));
      expect(labels(roll)).toEqual(['A Setpoint', 'B Setpoint', 'A Gyro', 'B Gyro']);
      expect(roll?.series[0]?.stroke).toBe(roll?.series[1]?.stroke);
      expect(roll?.series[0]?.dash).toBeUndefined();
      expect(roll?.series[1]?.dash).toEqual([4, 4]);
    });

    test('throttle is one line per log in log colours', () => {
      const lane = viewerLanes(logs, sel(['throttle'])).find((l) => l.id === 'throttle');
      expect(labels(lane)).toEqual(['A', 'B']);
    });

    test('one motor shown is compared across logs in log colours', () => {
      const [lane] = viewerLanes(logs, sel(['motors'], [], [1, 2, 3]));
      expect(labels(lane)).toEqual(['A', 'B']);
      expect(lane?.title).toBe('Motors — M1');
    });

    test('a log without the data adds no line, the others still show', () => {
      const mixed = [entry('A', { gyroRaw: false }), entry('B', {}, N, 1)];
      const [roll] = viewerLanes(mixed, sel(['gyroRaw', 'gyroFilt'], [0]));
      expect(labels(roll)).toEqual(['B Gyro prefilt', 'A Gyro', 'B Gyro']);
    });

    test('a shorter log is stretched to the first log’s length', () => {
      const [roll] = viewerLanes([entry('A'), entry('B', {}, 2, 1)], sel(['gyroFilt'], [0]));
      expect(roll?.series.map((s) => s.values.length)).toEqual([N, N]);
    });
  });
});

describe('matchingPreset', () => {
  test('the preset whose signals are exactly the selection', () => {
    expect(matchingPreset(new Set(['gyroFilt', 'setpoint']), [entry('A')])).toBe('tracking');
  });

  test('an extra or missing signal matches no preset', () => {
    expect(matchingPreset(new Set(['gyroFilt', 'setpoint', 'pidErr']), [entry('A')])).toBeNull();
    expect(matchingPreset(new Set(['setpoint']), [entry('A')])).toBeNull();
    expect(matchingPreset(new Set(), [entry('A')])).toBeNull();
  });

  test('signals the log lacks are ignored on both sides', () => {
    const noErpm = [entry('A', { eRpm: false })];
    expect(matchingPreset(new Set(['throttle', 'motors']), noErpm)).toBe('motors');
    expect(matchingPreset(new Set(['throttle', 'motors', 'eRpm']), noErpm)).toBe('motors');
  });
});
