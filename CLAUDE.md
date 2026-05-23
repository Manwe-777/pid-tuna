# Contributing to PIDTuna

Practical guide for anyone (human or AI) making changes to this repo. Keep
changes small, run the checks below before pushing, and follow the patterns
that already exist rather than inventing parallel ones.

## What this is

A fully client-side React + Vite app that parses Betaflight blackbox logs and
runs DSP on them. No backend, no auth, no database. Ships in three forms from
the same source: hosted web app (GitHub Pages), installable PWA (offline via
service worker), and a Tauri 2 desktop wrapper. See `README.md` for the user-
facing overview.

## Layout

```
src/
  App.tsx              the whole UI — section components, tab routing
  components/          small reusable components (TimeSeriesPlot, LogDotPlot, etc.)
  dsp/                 pure analysis code, one file per concern
    stepResponse.ts    Wiener deconvolution
    spectrogram.ts     PSDs / spectrograms (exports combinePsds for pooling)
    motorBalance.ts    motor stats + per-motor PSDs (exports combineMotorBalances)
    scorecard.ts       triage roll-up (uses combine* helpers when merging)
    latency.ts, battery.ts, gps*.ts, filters.ts, saturation.ts
  parser.ts            blackbox-log adapter, builds ParsedLog incl. `presence` flags
  sliceLog.ts          time-range slice of a ParsedLog
  logs.ts              LogSlot type, slot ID generator, multi-log colour palette
  types.ts             ParsedLog, DataPresence, axis aliases
  tuneView.ts          extracts PID config from the parsed setup headers
src-tauri/             Tauri 2 desktop wrapper (Rust + tauri.conf.json)
public/                static assets (icons, wordmark) — served at site root
.github/workflows/     ci.yml, build.yml (desktop releases), pages.yml
```

## Running the app

```bash
pnpm install
pnpm dev               # web dev server on :5173
pnpm tauri:dev         # desktop dev (Rust compile on first run ~2 min)
```

## Checks before pushing

```bash
pnpm typecheck         # tsc -b --noEmit, must be clean
pnpm build             # full Vite production build, must succeed
```

There is **no automated test suite right now**. Don't add one casually — if you
do, pick `vitest` (Vite-native, jsdom env) and wire it into `ci.yml` alongside
typecheck. For DSP iteration we write throwaway Node `.mjs` harnesses (see git
history for `test-wiener.mjs` shape) — write them under the project root, run
against a real log on `~/Desktop/LOG*.BFL`, then `rm` when done. Don't commit
them.

For UI changes, exercise the path in both `pnpm dev` (regular browser) and
`pnpm tauri:dev` (WKWebView). Behaviour can diverge — the file picker is the
classic example.

## Versioning (semver)

`MAJOR.MINOR.PATCH`. Bump rules for this surface area:

- **MAJOR** — log-schema changes that break older saved analyses, breaking
  changes to any exported `dsp/*` function signature, scorecard rubric
  thresholds being moved enough to flip an existing log's status.
- **MINOR** — new tabs, new merge primitives, new DSP analyses, additive UI.
- **PATCH** — bug fixes, internal cleanups, dependency bumps, docs.

Three files must be bumped together at release time:

1. `package.json` → drives the web UI's header pill and Tauri's bundle version
2. `src-tauri/Cargo.toml` → the Rust crate's own version (kept in sync manually)
3. `src-tauri/Cargo.lock` → contains the crate version too (rebuild or hand-edit)

Then `git tag v<version> && git push origin v<version>` triggers `build.yml`,
which produces a draft GitHub Release with cross-platform installers attached.
The `pages.yml` workflow auto-redeploys the hosted web app on every push to
`main` independently.

## Patterns to follow

These exist because we've already needed them — match them when extending.

### Per-log `presence` flags drive tab availability

`ParsedLog.presence: DataPresence` (defined in `types.ts`, populated in
`parser.ts`) tracks which optional fields were actually in the source log
versus zero-filled by the parser. The sidebar / tab bar uses
`tabHasData(tabId, entries)` in `App.tsx` to dim and disable tabs whose data
is missing from every loaded log.

If you add a new analysis that depends on a new optional log field:

1. Add a flag to `DataPresence` in `types.ts`.
2. Populate it in `parser.ts` based on `cols.has(...)` or a sawX-style flag.
3. Add the tab → flag mapping in `tabHasData()`.

Don't check for "all zeros in the array" at the call site — the presence flag
is the source of truth.

### Multi-log views ship with a "Merge logs" toggle

Four tabs already do this: **Scorecard**, **Step response**, **Full spectrum**,
**Motors balance**. Each uses a matching combine primitive from the dsp module:

| Tab | Primitive |
|---|---|
| Step response | `combineStepResponses` (`dsp/stepResponse.ts`) — pools accepted segments |
| Full spectrum | `combinePsds` (`dsp/spectrogram.ts`) — linear-power weighted Welch combine |
| Motors balance | `combineMotorBalances` (`dsp/motorBalance.ts`) — pools stats + PSDs, re-derives axes |
| Scorecard | `buildMergedScorecard` (`dsp/scorecard.ts`) — composes the three above |

UI uses the shared `<MergeLogsToggle>` and `makeMergedSlot(entries)` helpers
in `App.tsx`. When adding another mergeable tab, write a `combineXxx()` in the
dsp module that follows the same shape (skip mismatched-shape inputs silently,
re-derive any threshold/status from the pooled result rather than averaging
flags), then drop the toggle in.

### Base-path handling

The same source ships under three base paths:

| Target | Base | How set |
|---|---|---|
| Local dev / preview / Tauri | `/` | Vite default |
| GitHub Pages | `/pid-tuna/` | `VITE_BASE_PATH=/pid-tuna/` env in `pages.yml` |

For asset references in `index.html`, use absolute paths starting with `/` —
Vite rewrites these. **For asset references in TSX**, use
`${import.meta.env.BASE_URL}<path>` since Vite does *not* rewrite paths in JSX
strings. See the header logo in `App.tsx` for the pattern.

### Per-log compute → mean → metrics pipeline

DSP modules expose `compute<X>(perLogInputs, opts)` that returns a result with
both `segments[]` (the per-window raw estimates) and a `mean` derived from
them. Metrics like rise time / overshoot are computed from the mean, not from
each segment. When merging across logs the segments get pooled, the mean is
recomputed from the bigger pool, and the metrics from that — that's why the
combine primitives work.

### Yaw is excluded from rating rubrics

Step-response rise / overshoot and tracking-latency status thresholds use
`RATED_AXES = [0, 1]` (roll + pitch only). Yaw is shown but not scored —
most pilots don't actively tune it and quiet yaw on a fixed-camera log gives
noisy values that would unfairly drag scorecards down. If you add a new
scorecard row that scores per-axis, exclude yaw the same way.

## Commit and PR style

- One commit per logical change. Multi-paragraph bodies explaining *why*, not
  just what. Look at existing commits (`git log --no-merges`) for the shape.
- `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
  trailer when an AI did meaningful authoring — current default.
- Imperative mood subject line ("fix the X" not "fixed the X").
- Conventional-commits-ish prefixes are used loosely (`feat:`, `ci:`, `docs:`)
  but not enforced.
- Don't rewrite history of pushed commits. Tags are mostly fine to move
  *before* a release is published; once published, never.

## Common gotchas

- **Firmware version patch.** The deprecated `blackbox-log` parser rejects
  year-numbered firmware versions like `2026.6.0-alpha`. `parser.ts` rewrites
  the firmware-version header in-memory to `4.4.0` before parsing, preserving
  byte length. If parsing breaks on a new firmware, check that patch.
- **DataView compat shim.** `src/compat.ts` patches
  `DataView.prototype.byteLength` to return `0` on detached buffers instead of
  throwing, because `blackbox-log` v0.2.2 relies on the historical behaviour
  to detect WASM memory growth. **Must import before any blackbox-log code.**
  `main.tsx` does this — keep it that way.
- **WASM is base64-inlined.** `blackbox-log` v0.2.2 inlines the parser WASM
  into its JS bundle. That's why our app bundle is ~800 KB and why the PWA
  service worker can precache the whole parser. No separate `.wasm` request
  at runtime.
- **Tauri webview ≠ browser.** The HTML `<input type="file">` dialog doesn't
  reliably open in WKWebView; `FilePicker.tsx` detects `window.__TAURI_INTERNALS__`
  and uses the Tauri `dialog` + `fs` plugins instead. Drag-and-drop is captured
  by the OS before the webview sees it. Keep that branch when changing the
  file-picker UX.
- **PWA cache after asset rename.** vite-plugin-pwa hashes asset filenames,
  so old service workers serve the old bundle. If a user reports stale UI,
  they need a hard reload (Cmd+Shift+R) or service-worker unregister.

## What not to do

- Don't add a client-side router. The app is single-page; tabs are local
  state. If you genuinely need URL-shareable views, talk through the design
  first — naive routing breaks the PWA + Tauri base-path setup.
- Don't commit `dist/`, `dev-dist/`, `src-tauri/target/`, `src-tauri/gen/`,
  or `*.tsbuildinfo`. They're gitignored; if your tool spits them out
  elsewhere, fix that rather than untracking later.
- Don't introduce a CSS framework. `index.css` is hand-written, ~600 lines.
  Keep it that way — add classes near the existing ones.
- Don't add backend / server code. This is and will stay 100% client-side.
- Don't use `console.log` for anything user-visible. The Console is for
  developers; surface errors / warnings in the UI itself.
