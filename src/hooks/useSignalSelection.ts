import { useMemo, useState } from 'react';

import { SIGNAL_DEFS } from '../constants';
import type { SignalKey } from '../types';
import { toggleInSet } from '../utils/toggleInSet';

/**
 * Which signals the spectrum shows. One log: any number, toggled. Several logs:
 * only one, the first of the same set, so switching modes keeps a choice.
 */
export function useSignalSelection(multi: boolean) {
  const [selected, setSelected] = useState<ReadonlySet<SignalKey>>(() => new Set<SignalKey>(['gyroFilt']));
  const singleSelected: SignalKey = multi ? ([...selected][0] ?? 'gyroFilt') : 'gyroFilt';

  const activeDefs = useMemo(
    () =>
      multi ? SIGNAL_DEFS.filter((d) => d.key === singleSelected) : SIGNAL_DEFS.filter((d) => selected.has(d.key)),
    [multi, singleSelected, selected],
  );

  return {
    activeDefs,
    isChecked: (key: SignalKey) => (multi ? singleSelected === key : selected.has(key)),
    pick: (key: SignalKey) => (multi ? setSelected(new Set([key])) : setSelected((prev) => toggleInSet(prev, key))),
  };
}
