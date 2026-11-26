import type { FilterType } from '../types';

/** What the main frequency field means for a filter type. */
export function filterFrequencyLabel(type: FilterType): string {
  if (type === 'rpm') return 'Motor';

  return type === 'notch' || type === 'dynNotch' ? 'Centre' : 'Cutoff';
}
