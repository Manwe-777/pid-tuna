import { useSyncExternalStore } from 'react';

import { getTheme } from '../theme/getTheme';
import { subscribeTheme } from '../theme/subscribeTheme';
import type { Theme } from '../types';

/** Reactive current theme, so canvas and SVG plots re-render with matching chrome colors. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, getTheme, getTheme);
}
