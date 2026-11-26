import { describe, expect, test } from 'vitest';

import { BB_LOG_START } from '../constants';
import { findLogStarts } from './findLogStarts';
import { parseHeader } from './parseHeader';
import { ascii, frame, headerBytes, uvb } from './testing/buildLog';

const LINES: Array<[string, string]> = [
  ['Data version', '2'],
  ['I interval', '32'],
  ['P interval', '1/2'],
  ['Field I name', 'loopIteration,time,gyroData[0]'],
  ['Field I signed', '0,0,1'],
  ['Field I predictor', '0,0,0'],
  ['Field I encoding', '1,1,0'],
  ['Field P predictor', '6,2,1'],
  ['Field P encoding', '9,0,0'],
  ['minthrottle', '1070'],
  ['motorOutput', '158,2047'],
  ['Craft name', 'Test: quad'],
];

const log = () => [...ascii(BB_LOG_START), ...headerBytes(LINES), ...frame('I', uvb(0), uvb(100), [0])];

describe('parseHeader', () => {
  test('keeps every line and reads the frame layout', () => {
    const bytes = Uint8Array.from(log());
    const h = parseHeader(bytes, 0, bytes.length);
    expect(h.lines.get('Craft name')).toBe('Test: quad');
    expect(h.frameDefs.I?.names).toEqual(['loopIteration', 'time', 'gyroADC[0]']);
    expect(h.frameDefs.I?.signed).toEqual([false, false, true]);
    expect(h.dataVersion).toBe(2);
    expect([h.iInterval, h.pNum, h.pDenom]).toEqual([32, 1, 2]);
  });

  test('P frames take the I frame’s field names and signedness', () => {
    const bytes = Uint8Array.from(log());
    const { frameDefs } = parseHeader(bytes, 0, bytes.length);
    expect(frameDefs.P?.names).toEqual(frameDefs.I?.names);
    expect(frameDefs.P?.predictors).toEqual([6, 2, 1]);
  });

  test('motor predictions use motorOutput’s minimum when given, else minthrottle', () => {
    const bytes = Uint8Array.from(log());
    expect(parseHeader(bytes, 0, bytes.length).minMotor).toBe(158);
    const noMotorOutput = Uint8Array.from([...ascii(BB_LOG_START), ...headerBytes([['minthrottle', '1070']])]);
    expect(parseHeader(noMotorOutput, 0, noMotorOutput.length).minMotor).toBe(1070);
  });

  test('the header ends where the first data frame starts', () => {
    const bytes = Uint8Array.from(log());
    const h = parseHeader(bytes, 0, bytes.length);
    expect(String.fromCharCode(bytes[h.dataStart]!)).toBe('I');
  });
});

describe('findLogStarts', () => {
  test('finds each log of a file with several flights', () => {
    const one = log();
    const bytes = Uint8Array.from([...one, ...one, ...one]);
    expect(findLogStarts(bytes)).toEqual([0, one.length, 2 * one.length]);
  });

  test('a file without a blackbox header has no logs', () => {
    expect(findLogStarts(Uint8Array.from(ascii('H Product:Something else\n')))).toEqual([]);
  });
});
