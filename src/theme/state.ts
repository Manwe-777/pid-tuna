import type { Theme } from '../types';
import { readStoredTheme } from './readStoredTheme';
import { systemPrefersDark } from './systemPrefersDark';

/**
 * App-wide light/dark theme. The UI is styled with CSS custom properties that
 * flip on the `data-theme` attribute of the root element; this is the single
 * source of truth for which theme is active. Resolved once at load: a saved
 * preference wins, else the OS setting.
 */
export const themeState: { current: Theme; listeners: Set<() => void> } = {
  current: readStoredTheme() ?? (systemPrefersDark() ? 'dark' : 'light'),
  listeners: new Set(),
};
