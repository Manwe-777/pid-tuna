import { type ReactNode, useId, useState } from 'react';

import { PlotSyncContext, type PlotSyncScopeValue } from '../../plot/plotSyncContext';

/** Plots inside that name the same `syncGroup` zoom together and share the selection and cursor. */
export function PlotSyncScope({ children }: { children: ReactNode }) {
  const id = useId();
  const [value] = useState<PlotSyncScopeValue>(() => ({ id, groups: new Map() }));

  return <PlotSyncContext.Provider value={value}>{children}</PlotSyncContext.Provider>;
}
