import { useSyncExternalStore } from 'react';

/**
 * App-wide light/dark theme. The whole UI is styled with CSS custom properties
 * (see `index.css`) that flip on the `data-theme` attribute of the root
 * element. This module is the single source of truth for which theme is active:
 * it owns the persisted preference, applies the attribute, and exposes a
 * `useTheme()` hook so canvas / SVG plots — which can't read CSS variables from
 * their imperative draw code — re-render with matching chrome colors.
 */

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'pidtuna:theme';

function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

function readStored(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

// Resolve once at module load: explicit saved preference wins, else fall back to
// the OS setting (defaulting to dark — the app's original look).
let current: Theme = readStored() ?? (systemPrefersDark() ? 'dark' : 'light');

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Write `data-theme` onto <html>. Call before first paint to avoid a flash. */
export function applyTheme(theme: Theme = current) {
  current = theme;
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

export function getTheme(): Theme {
  return current;
}

export function setTheme(theme: Theme) {
  if (theme === current) return;
  current = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private-mode / storage-disabled: theme still applies for this session.
  }
  applyTheme(theme);
  emit();
}

export function toggleTheme() {
  setTheme(current === 'dark' ? 'light' : 'dark');
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Reactive current theme. Components re-render when the theme is toggled. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, getTheme);
}

/**
 * Chrome colors for imperatively-drawn plots (uPlot axes, canvas heatmap frames,
 * inline SVG). These mirror the neutral tokens in `index.css` so the plots match
 * the surrounding UI in each theme. Data-encoding colors (trace colors, the
 * viridis heatmap) are intentionally NOT here — they stay constant across themes.
 */
export interface PlotChrome {
  /** Grid lines / faint frames. */
  grid: string;
  /** uPlot axis stroke (tick labels + baseline). */
  axis: string;
  /** Tick marks / reference lines. */
  axisLine: string;
  /** Plot title text. */
  title: string;
  /** Primary tick-label text. */
  tick: string;
  /** Secondary axis captions (e.g. x tick numbers). */
  caption: string;
  /** Recessed axis labels (e.g. "log #"). */
  label: string;
}

export const PLOT_COLORS: Record<Theme, PlotChrome> = {
  dark: {
    grid: '#1d242e',
    axis: '#9aa4b2',
    axisLine: '#3a4150',
    title: '#c8ced9',
    tick: '#8a93a3',
    caption: '#6c7383',
    label: '#5a6473',
  },
  light: {
    grid: '#dce1e8',
    axis: '#5a6472',
    axisLine: '#b0b8c4',
    title: '#2a3038',
    tick: '#5b636f',
    caption: '#7d8490',
    label: '#949ba6',
  },
};
