import { THEME_STORAGE_KEY } from '../constants';
import type { Theme } from '../types';
import { applyTheme } from './applyTheme';
import { themeState } from './state';

export function setTheme(theme: Theme) {
  if (theme === themeState.current) return;
  themeState.current = theme;

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private-mode / storage-disabled: theme still applies for this session.
  }

  applyTheme(theme);
  for (const l of themeState.listeners) l();
}
