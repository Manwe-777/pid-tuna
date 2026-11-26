import type { BbFrameDef, BbFrameType } from '../types';

const FRAME_TYPES = new Set<string>(['I', 'P', 'S', 'G', 'H']);

/** Old logs call the filtered gyro `gyroData`. */
function modernName(name: string): string {
  return name.replace(/^gyroData/, 'gyroADC');
}

/**
 * Applies one `Field <type> <part>` header line to the frame definitions. Returns false
 * when the line isn't a field definition.
 */
export function parseFrameDefLine(
  defs: Partial<Record<BbFrameType, BbFrameDef>>,
  name: string,
  value: string,
): boolean {
  const m = /^Field (.) (.+)$/.exec(name);
  if (!m || !FRAME_TYPES.has(m[1]!)) return false;
  const type = m[1] as BbFrameType;
  const def = (defs[type] ??= { names: [], predictors: [], encodings: [], signed: [] });
  const numbers = () => value.split(',').map((v) => Number.parseInt(v, 10));

  if (m[2] === 'name') def.names = value.split(',').map(modernName);
  else if (m[2] === 'predictor') def.predictors = numbers();
  else if (m[2] === 'encoding') def.encodings = numbers();
  else if (m[2] === 'signed') def.signed = numbers().map((v) => v === 1);

  return true;
}
