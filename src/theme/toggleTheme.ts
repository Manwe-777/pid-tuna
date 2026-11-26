import { setTheme } from './setTheme';
import { themeState } from './state';

export function toggleTheme() {
  setTheme(themeState.current === 'dark' ? 'light' : 'dark');
}
