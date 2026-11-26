import { meanOf } from '../../utils/meanOf';

export function scaleToLevel(trace: Float32Array, from: number, level: number): void {
  const own = meanOf(trace, from, trace.length);
  if (!(Math.abs(own) > 1e-6) || !Number.isFinite(level)) return;

  const k = level / own;
  for (let i = 0; i < trace.length; i++) trace[i] = trace[i]! * k;
}
