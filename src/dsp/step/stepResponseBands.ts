import { STEP_BAND_EDGES } from '../../constants';
import type { ParsedLog, StepBand, StepBandKind, StepLogOptions } from '../../types';
import { stepResponseForLog } from './stepResponseForLog';

/**
 * Step response split into bands of stick input or throttle, to show where the
 * drone behaves differently (TPA, saturation on big moves, prop wash at low
 * throttle). Each band uses the same analysis as the whole-flight estimate.
 */
export function stepResponseBands(
  log: ParsedLog,
  axis: number,
  kind: StepBandKind,
  options: StepLogOptions = {},
  edges: number[] = STEP_BAND_EDGES[kind],
): StepBand[] {
  const bands: StepBand[] = [];

  for (let i = 0; i + 1 < edges.length; i++) {
    const from = edges[i]!;
    const to = edges[i + 1]!;
    const range =
      kind === 'stick' ? { minExcitation: from, maxExcitation: to } : { minThrottle: from, maxThrottle: to };
    const unit = kind === 'stick' ? 'deg/s' : '%';
    const label = Number.isFinite(to) ? `${from}–${to} ${unit}` : `${from}+ ${unit}`;
    bands.push({ label, from, to, result: stepResponseForLog(log, axis, { ...options, ...range }) });
  }

  return bands;
}
