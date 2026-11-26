# PIDTuna

Project facts. General conventions (structure, tooling, tests, commits) are in `~/Projects/CLAUDE.md`.

## What it is

A client-side React app that parses Betaflight blackbox logs and runs DSP on them. No backend. It ships as the GitHub Pages site, an offline PWA and a Tauri 2 desktop app, all from the same source.

## Layout

- `src/dsp/` — analyses, one function per file, grouped by analysis (`step/`, `spectrum/`, `filters/`, `gps/`, `balance/`, `scorecard/`); `dsp/testing/` holds the simulated drone used by accuracy tests.
- `src/parser/` — the `blackbox-log` adapter that builds `ParsedLog`.
- `src/plot/` — canvas and uPlot drawing used by the plot components.
- `src/logs/` — the `LogLibrary` class and per-log helpers.
- `src/components/<tab>/` — one folder per tab.

## Analysis rules

- `ParsedLog.presence` records which optional fields the log really had. `tabHasData` uses it to disable tabs; never infer presence from all-zero arrays.
- Results keep the pooled state a merge needs (Welch power for spectra, summed cross-spectra for step response). Merging logs pools that state and re-derives the metrics; never average finished metrics. Mergeable tabs use `combineStepResponses`, `combinePsds`, `combineMotorBalances` and `buildMergedScorecard`, with `MergeLogsToggle` and `makeMergedSlot`.
- Step response pools cross-spectra (H1), not per-window deconvolutions. The tab and the scorecard share `STEP_DEFAULTS` and `STEP_MASK_DEFAULTS`.
- Analyses run takeoff to landing (`flightRange`: stick throttle at or above 20% for 0.5 s). Throttle in percent comes from `throttlePercentSeries` (rcCommand[3]).
- Yaw is shown but never rated: scorecard rows score `RATED_AXES = [0, 1]` only.

## UI rules

- Tooltips are `data-tip` attributes on DOM elements, shown by the one `TooltipLayer` mounted in `App`. Native `title` is a lint error.
- Buttons use `btn` (with `btn--sm` or `btn--primary`); a checkbox with its label uses `toggle`, which `.controls` applies automatically. Settings with several parts go in a `control-panel` of `ControlGroup`s.

## Tests

- Accuracy tests assert against the simulated drone's known response, not against current output. A known inaccuracy is a `test.fails` case.
- Real-log tests run only with `PIDTUNA_LOG_DIR` set; `pid/` under it holds a 13-flight tuning session. Logs are never committed.

## Parser and platform quirks

- `blackbox-log` 0.2.2 rejects year-numbered firmware versions (e.g. `2026.6.0`); `parseLog` rewrites the header to `4.4.0` in memory, keeping the byte length.
- `parser/compat.ts` makes `DataView.byteLength` return 0 on detached buffers, which the parser relies on. It must be imported before any `blackbox-log` code; `main.tsx` imports it first.
- The parser WASM is inlined in its JS, so the bundle is large and the PWA precaches the whole parser.
- In Tauri the HTML file input is unreliable; `FilePicker` uses the dialog and fs plugins when `window.__TAURI_INTERNALS__` exists. Exercise file picking in both `pnpm dev` and `pnpm tauri:dev`.
- An old service worker can serve a stale build after a release; a hard reload fixes it.

## Paths and versions

- Pages serves under `/pid-tuna/` (`VITE_BASE_PATH`); local, preview and Tauri use `/`. Asset paths in TSX use `${import.meta.env.BASE_URL}`, since Vite doesn't rewrite JSX strings.
- The version lives in git tags. semantic-release cuts it on `main`; builds read `APP_VERSION` or `git describe`, and the desktop build stamps it into `package.json` and `Cargo.toml` (both hold 0.0.0 in git).
- No client-side router: tabs are local state, and routing would break the PWA and Tauri base paths.
