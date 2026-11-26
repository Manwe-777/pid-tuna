import type { ParsedLog, SignalKey } from '../types';

export function extractSignal(log: ParsedLog, key: SignalKey, axis: number): Float32Array | null {
  switch (key) {
    case 'gyroFilt':
      return log.gyroFilt[axis] ?? null;
    case 'gyroRaw':
      return log.gyroRaw[axis] ?? null;
    case 'pterm':
      return log.pTerm[axis] ?? null;
    case 'iterm':
      return log.iTerm[axis] ?? null;
    case 'dterm':
      return axis < 2 ? (log.dTerm[axis] ?? null) : null;
    case 'dtermRaw': {
      // -diff(gyroFilt) — conventional DtermRaw-style derivative.
      if (axis >= 2) return null;
      const gyro = log.gyroFilt[axis]!;
      const out = new Float32Array(gyro.length);
      for (let i = 0; i < gyro.length - 1; i++) out[i] = -(gyro[i + 1]! - gyro[i]!);
      return out;
    }
    case 'fterm':
      return log.fTerm[axis] ?? null;
    case 'pidsum': {
      const p = log.pTerm[axis]!;
      const ii = log.iTerm[axis]!;
      const d = axis < 2 ? log.dTerm[axis]! : new Float32Array(p.length);
      const f = log.fTerm[axis]!;
      const out = new Float32Array(p.length);
      for (let i = 0; i < p.length; i++) out[i] = p[i]! + ii[i]! + d[i]! + f[i]!;
      return out;
    }
    case 'pidErr': {
      const sp = log.setpoint[axis]!;
      const gy = log.gyroFilt[axis]!;
      const out = new Float32Array(sp.length);
      for (let i = 0; i < sp.length; i++) out[i] = sp[i]! - gy[i]!;
      return out;
    }
    case 'setpoint':
      return log.setpoint[axis] ?? null;
    case 'motor0':
      return log.motor[0] ?? null;
    case 'motor1':
      return log.motor[1] ?? null;
    case 'motor2':
      return log.motor[2] ?? null;
    case 'motor3':
      return log.motor[3] ?? null;
  }
}
