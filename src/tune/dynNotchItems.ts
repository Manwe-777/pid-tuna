import type { TuneItem, TuneView } from '../types';

const hz = (v: number | undefined) => (v != null ? `${v} Hz` : null);

export function dynNotchItems(view: TuneView): TuneItem[] {
  return [
    ['Count', view.dynNotchCount],
    ['Min freq', hz(view.dynNotchMin)],
    ['Max freq', hz(view.dynNotchMax)],
    ['Q', view.dynNotchQ],
  ];
}
