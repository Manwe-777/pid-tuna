import type { ParsedLog, SignalKey } from '../types';

type Extractor = (log: ParsedLog, axis: number) => Float32Array | null;

const EXTRACTORS: Record<SignalKey, Extractor> = {
  gyroFilt: (log, axis) => log.gyroFilt[axis] ?? null,
  gyroRaw: (log, axis) => log.gyroRaw[axis] ?? null,
  pterm: (log, axis) => log.pTerm[axis] ?? null,
  iterm: (log, axis) => log.iTerm[axis] ?? null,
  dterm: (log, axis) => (axis < 2 ? (log.dTerm[axis] ?? null) : null),
  dtermRaw: dtermRaw,
  fterm: (log, axis) => log.fTerm[axis] ?? null,
  pidsum: pidSum,
  pidErr: pidError,
  setpoint: (log, axis) => log.setpoint[axis] ?? null,
  motor0: (log) => log.motor[0] ?? null,
  motor1: (log) => log.motor[1] ?? null,
  motor2: (log) => log.motor[2] ?? null,
  motor3: (log) => log.motor[3] ?? null,
};

export function extractSignal(log: ParsedLog, key: SignalKey, axis: number): Float32Array | null {
  // Optional call: an unknown key gives undefined, as the old switch did.
  return EXTRACTORS[key]?.(log, axis);
}

/** -diff(gyroFilt) — conventional DtermRaw-style derivative. */
function dtermRaw(log: ParsedLog, axis: number): Float32Array | null {
  if (axis >= 2) return null;
  const gyro = log.gyroFilt[axis]!;
  const out = new Float32Array(gyro.length);
  for (let i = 0; i < gyro.length - 1; i++) out[i] = -(gyro[i + 1]! - gyro[i]!);
  return out;
}

function pidSum(log: ParsedLog, axis: number): Float32Array {
  const p = log.pTerm[axis]!;
  const ii = log.iTerm[axis]!;
  const d = axis < 2 ? log.dTerm[axis]! : new Float32Array(p.length);
  const f = log.fTerm[axis]!;
  const out = new Float32Array(p.length);
  for (let i = 0; i < p.length; i++) out[i] = p[i]! + ii[i]! + d[i]! + f[i]!;
  return out;
}

function pidError(log: ParsedLog, axis: number): Float32Array {
  const sp = log.setpoint[axis]!;
  const gy = log.gyroFilt[axis]!;
  const out = new Float32Array(sp.length);
  for (let i = 0; i < sp.length; i++) out[i] = sp[i]! - gy[i]!;
  return out;
}
