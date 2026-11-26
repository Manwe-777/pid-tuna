import type { ParsedLog } from '../types';

/** Motor pole pairs from the motor_poles header, else 7 (a 14-pole motor). */
export function initialPolePairs(log: ParsedLog): number {
  const poles = Number.parseFloat(log.setup.rawHeaders.motor_poles ?? '');

  return poles >= 2 ? Math.round(poles / 2) : 7;
}
