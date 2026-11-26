import { createContext } from 'react';

import type { ZoomGroup } from './ZoomGroup';

/** The plot groups of one tab, by name, and an id that keeps their cursor sync keys apart from other tabs'. */
export interface PlotSyncScopeValue {
  id: string;
  groups: Map<string, ZoomGroup>;
}

export const PlotSyncContext = createContext<PlotSyncScopeValue | null>(null);
