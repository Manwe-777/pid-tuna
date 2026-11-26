import type { ParsedLog } from '../types';
import type { StepResponseResult } from './stepResponse';
import { type StepLogOptions, stepResponseForLog } from './stepResponseForLog';

export type StepBandKind = 'stick' | 'throttle';

export interface StepBand {
  label: string;
  from: number;
  to: number;
  result: StepResponseResult;
}

/** Default band edges: stick input in deg/s (window mean |setpoint|), throttle in %. */
export const STEP_BAND_EDGES: Record<StepBandKind, number[]> = {
  stick: [20, 100, 250, Infinity],
  throttle: [15, 35, 55, 100],
};

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
