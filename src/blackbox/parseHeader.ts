import type { BbHeader } from '../types';
import { ByteReader } from './ByteReader';
import { parseFrameDefLine } from './parseFrameDefLine';

const SPACE = 0x20;

const COLON = 0x3a;

const NEWLINE = 0x0a;

/** Bytes that start a data frame; the header ends at the first one. */
const FRAME_MARKERS = new Set([0x49, 0x50, 0x53, 0x47, 0x45]); // I P S G E

const MAX_LINE = 1024;

const int = (lines: Map<string, string>, key: string, fallback: number) => {
  const v = Number.parseInt(lines.get(key) ?? '', 10);

  return Number.isFinite(v) ? v : fallback;
};

/** "P interval" is `num/denom`, or a plain denominator in old logs. */
function pInterval(value: string | undefined): { pNum: number; pDenom: number } {
  if (!value) return { pNum: 1, pDenom: 1 };
  const [a, b] = value.split('/').map((v) => Number.parseInt(v, 10));
  if (b === undefined) return { pNum: 1, pDenom: Math.max(1, a || 1) };

  return { pNum: Math.max(1, a || 1), pDenom: Math.max(1, b || 1) };
}

/** Reads one `H name:value` line after its `H`; null when the bytes aren't a header line. */
function readLine(r: ByteReader): { name: string; value: string } | null {
  if (r.peek() !== SPACE) return null;
  r.pos++;
  const start = r.pos;
  let colon = -1;

  for (; r.pos < r.end && r.pos < start + MAX_LINE; r.pos++) {
    const c = r.data[r.pos]!;
    if (c === COLON && colon < 0) colon = r.pos;
    if (c === NEWLINE || c === 0) break;
  }

  if (r.data[r.pos] !== NEWLINE || colon < 0) return null;
  const text = (a: number, b: number) => String.fromCharCode(...r.data.subarray(a, b));
  const line = { name: text(start, colon), value: text(colon + 1, r.pos) };
  r.pos++;

  return line;
}

/** Parses the header of the log starting at `start`, up to its first data frame. */
export function parseHeader(data: Uint8Array, start: number, end: number): BbHeader {
  const r = new ByteReader(data, start, end);
  const lines = new Map<string, string>();
  const frameDefs: BbHeader['frameDefs'] = {};

  while (r.pos < r.end) {
    const c = r.byte();

    if (FRAME_MARKERS.has(c)) {
      r.pos--;
      break;
    }

    const line = c === 0x48 ? readLine(r) : null; // H
    if (!line) continue;
    lines.set(line.name, line.value);
    parseFrameDefLine(frameDefs, line.name, line.value);
  }

  // P frames are deltas of I frames: their header has predictors and encodings but no names.
  if (frameDefs.I && frameDefs.P) {
    frameDefs.P.names = frameDefs.I.names;
    frameDefs.P.signed = frameDefs.I.signed;
  }

  const minThrottle = int(lines, 'minthrottle', 1150);
  const motorOutputMin = Number.parseInt((lines.get('motorOutput') ?? '').split(',')[0] ?? '', 10);

  return {
    lines,
    frameDefs,
    dataVersion: int(lines, 'Data version', 1),
    iInterval: Math.max(1, int(lines, 'I interval', 32)),
    ...pInterval(lines.get('P interval')),
    minThrottle,
    minMotor: Number.isFinite(motorOutputMin) ? motorOutputMin : minThrottle,
    vbatRef: int(lines, 'vbatref', 4095),
    dataStart: r.pos,
  };
}
