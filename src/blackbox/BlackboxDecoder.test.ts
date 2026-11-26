import { describe, expect, test } from 'vitest';

import { BB_END_OF_LOG, BB_EVENT, BB_LOG_START } from '../constants';
import type { BbEvent } from '../types';
import { BlackboxDecoder } from './BlackboxDecoder';
import { parseHeader } from './parseHeader';
import { ascii, frame, headerBytes, svb, uvb } from './testing/buildLog';

/** Fields: loopIteration, time, a (predicted from the previous frame), b (from the average of the last two). */
function header(pInterval = '1/1') {
  return [
    ...ascii(BB_LOG_START),
    ...headerBytes([
      ['Data version', '2'],
      ['I interval', '32'],
      ['P interval', pInterval],
      ['Field I name', 'loopIteration,time,a,b'],
      ['Field I signed', '0,0,1,1'],
      ['Field I predictor', '0,0,0,0'],
      ['Field I encoding', '1,1,0,0'],
      ['Field P predictor', '6,2,1,3'],
      ['Field P encoding', '9,0,0,0'],
    ]),
  ];
}

const iFrame = (it: number, time: number, a: number, b: number) => frame('I', uvb(it), uvb(time), svb(a), svb(b));

const pFrame = (dt: number, da: number, db: number) => frame('P', svb(dt), svb(da), svb(db));

function decode(bytes: number[]) {
  const data = Uint8Array.from(bytes);
  const h = parseHeader(data, 0, data.length);
  const main: number[][] = [];
  const events: BbEvent[] = [];
  new BlackboxDecoder(data, h, data.length).run({ main: (v) => main.push([...v]), event: (e) => events.push(e) });

  return { main, events };
}

describe('BlackboxDecoder', () => {
  test('P frames add their deltas to what the predictors expect', () => {
    const { main } = decode([...header(), ...iFrame(0, 1000, 10, 100), ...pFrame(500, 2, 4), ...pFrame(0, -1, 1)]);
    expect(main).toEqual([
      [0, 1000, 10, 100],
      // Time on a straight line from the I frame, which fills both history slots.
      [1, 1500, 12, 104],
      [2, 2000, 11, 103],
    ]);
  });

  test('right after an I frame, the average predictor averages the I frame with itself', () => {
    const { main } = decode([
      ...header(),
      ...iFrame(0, 1000, 0, 100),
      ...pFrame(500, 0, 10),
      ...iFrame(2, 2000, 0, 200),
      ...pFrame(500, 0, 3),
    ]);
    // Not (200 + 110) / 2: the P frame before the I frame is no longer history.
    expect(main[3]?.[3]).toBe(203);
  });

  test('iterations count the frames the logging rate skips', () => {
    const { main } = decode([...header('1/2'), ...iFrame(0, 1000, 0, 0), ...pFrame(500, 0, 0), ...pFrame(0, 0, 0)]);
    expect(main.map((f) => f[0])).toEqual([0, 2, 4]);
  });

  test('a corrupt frame drops the P frames after it until the next I frame', () => {
    const garbage = Array.from({ length: 300 }, () => 0x01);
    const { main } = decode([
      ...header(),
      ...iFrame(0, 1000, 0, 0),
      ...frame('P', garbage),
      ...pFrame(500, 0, 0),
      ...iFrame(4, 3000, 7, 7),
      ...pFrame(500, 1, 1),
    ]);
    expect(main.map((f) => f[0])).toEqual([0, 4, 5]);
  });

  test('an I frame whose time runs backwards is rejected', () => {
    const { main } = decode([...header(), ...iFrame(0, 50_000, 0, 0), ...iFrame(32, 80, 0, 0), ...pFrame(1, 0, 0)]);
    expect(main.map((f) => f[1])).toEqual([50_000]);
  });

  test('events keep their data and the time of the last main frame', () => {
    const { events } = decode([
      ...header(),
      ...iFrame(0, 1000, 0, 0),
      ...frame('E', [BB_EVENT.flightMode], uvb(5), uvb(1)),
      ...frame('E', [BB_EVENT.disarm], uvb(4)),
      ...pFrame(500, 0, 0),
    ]);
    expect(events).toEqual([
      { type: BB_EVENT.flightMode, time: 1000, data: { newFlags: 5, lastFlags: 1 } },
      { type: BB_EVENT.disarm, time: 1000, data: { reason: 4 } },
    ]);
  });

  test('nothing after the end-of-log event is read', () => {
    const { main, events } = decode([
      ...header(),
      ...iFrame(0, 1000, 0, 0),
      ...frame('E', [BB_EVENT.logEnd], ascii(BB_END_OF_LOG)),
      ...iFrame(32, 2000, 0, 0),
    ]);
    expect(main).toHaveLength(1);
    expect(events.map((e) => e.type)).toEqual([BB_EVENT.logEnd]);
  });

  test('unsigned fields past 2^31 stay positive', () => {
    const { main } = decode([...header(), ...iFrame(0, 3_000_000_000, 0, 0), ...pFrame(1, 0, 0)]);
    expect(main.map((f) => f[1])).toEqual([3_000_000_000, 3_000_000_001]);
  });

  test('a log without main frame definitions is refused', () => {
    const data = Uint8Array.from([...ascii(BB_LOG_START), ...headerBytes([['Data version', '2']])]);
    expect(() => new BlackboxDecoder(data, parseHeader(data, 0, data.length), data.length)).toThrow(/I frame/);
  });
});
