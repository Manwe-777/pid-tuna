import type { TuneItem, TuneView } from '../types';

export function rpmFilterItems(view: TuneView): TuneItem[] {
  return [
    ['Harmonics', view.rpmHarmonics],
    ['Min freq', view.rpmMinHz != null ? `${view.rpmMinHz} Hz` : null],
    ['Q', view.rpmQ],
  ];
}
