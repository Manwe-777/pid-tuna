import type { Theme } from '../types';
import { themeState } from './state';

/** Write `data-theme` onto <html>. Call before first paint to avoid a flash. */
export function applyTheme(theme: Theme = themeState.current) {
  themeState.current = theme;

  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }
}
