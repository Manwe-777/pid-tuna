import { themeState } from './state';

export function subscribeTheme(cb: () => void): () => void {
  themeState.listeners.add(cb);
  return () => themeState.listeners.delete(cb);
}
