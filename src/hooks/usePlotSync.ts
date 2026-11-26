import { useContext, useState } from 'react';

import { PlotSyncContext } from '../plot/plotSyncContext';
import { ZoomGroup } from '../plot/ZoomGroup';

/**
 * The zoom group and cursor sync key for a plot: the named group of the surrounding
 * `PlotSyncScope`, or a group of its own (and no cursor sync) without a name or scope.
 */
export function usePlotSync(name: string | undefined): { group: ZoomGroup; syncKey?: string } {
  const scope = useContext(PlotSyncContext);
  const [own] = useState(() => new ZoomGroup());
  if (!scope || !name) return { group: own };

  let group = scope.groups.get(name);

  if (!group) {
    group = new ZoomGroup();
    scope.groups.set(name, group);
  }

  return { group, syncKey: `${scope.id}:${name}` };
}
