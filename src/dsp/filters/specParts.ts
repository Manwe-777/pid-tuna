import type { FilterPart, FilterSpec } from '../../types';
import { rpmNotchParts } from './rpmNotchParts';

/** The filter parts a spec stands for, in Betaflight terms. */
export function specParts(f: FilterSpec, loopHz: number): FilterPart[] {
  if (!f.enabled || !Number.isFinite(f.cutoffHz)) return [];

  switch (f.type) {
    case 'rpm':
      return rpmNotchParts(
        f.cutoffHz,
        f.count ?? 3,
        (f.bfQ ?? 500) / 100,
        f.minHz ?? 100,
        f.fadeHz ?? 50,
        f.weights ?? [],
        f.motors ?? 4,
        loopHz,
      );
    case 'dynNotch':
      return [{ kind: 'notch', hz: f.cutoffHz, q: (f.bfQ ?? 300) / 100, copies: f.count ?? 1 }];
    case 'notch':
      return f.bandwidth > 0 ? [{ kind: 'notch', hz: f.cutoffHz, q: f.cutoffHz / f.bandwidth }] : [];
    default:
      return [{ kind: f.type, hz: f.cutoffHz }];
  }
}
