import { ALL_AXIS, AXIS_COLORS, AXIS_NAMES } from '../constants';

/** Name and colour for the selected axis, or the grey "All axes". */
export function spectralAxisLabel(axis: number): { name: string; color: string } {
  return axis === ALL_AXIS
    ? { name: 'All axes', color: '#aab4c4' }
    : { name: AXIS_NAMES[axis]!, color: AXIS_COLORS[axis]! };
}
