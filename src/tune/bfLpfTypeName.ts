import { BF_LPF_TYPES } from '../constants';

/** Betaflight's name for a lowpass type id, e.g. PT1; unknown ids read "type N". */
export function bfLpfTypeName(id?: number): string | undefined {
  if (id == null) return undefined;

  return BF_LPF_TYPES[String(id)] ?? `type ${id}`;
}
