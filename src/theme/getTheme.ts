import type { Theme } from '../types';
import { themeState } from './state';

export function getTheme(): Theme {
  return themeState.current;
}
