<p align="center">
  <img src="public/pidtuna-wordmark.svg" alt="PIDTuna" width="320" />
</p>

<p align="center">
  <img src="public/tunawaves.svg" alt="" width="520" />
</p>

<p align="center">
  <a href="https://github.com/Manwe-777/pid-tuna/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/Manwe-777/pid-tuna/ci.yml?branch=main&label=CI&style=flat-square"></a>
  <a href="https://github.com/Manwe-777/pid-tuna/actions/workflows/pages.yml"><img alt="Pages deploy" src="https://img.shields.io/github/actions/workflow/status/Manwe-777/pid-tuna/pages.yml?branch=main&label=pages&style=flat-square"></a>
  <a href="https://manwe-777.github.io/pid-tuna/"><img alt="Live demo" src="https://img.shields.io/badge/demo-manwe--777.github.io%2Fpid--tuna-6666ff?style=flat-square"></a>
  <a href="https://github.com/Manwe-777/pid-tuna/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/Manwe-777/pid-tuna?include_prereleases&style=flat-square&label=release"></a>
  <a href="LICENSE"><img alt="License: AGPL-3.0" src="https://img.shields.io/github/license/Manwe-777/pid-tuna?style=flat-square"></a>
  <a href="https://tauri.app/"><img alt="Built with Tauri 2" src="https://img.shields.io/badge/desktop-Tauri%202-24c8db?style=flat-square&logo=tauri&logoColor=white"></a>
</p>

<p align="center">
  <strong>👉 <a href="https://manwe-777.github.io/pid-tuna/">Try it now at manwe-777.github.io/pid-tuna</a></strong> — no install, drop a <code>.bbl</code>/<code>.bfl</code> in and go.
</p>

Browser-based Betaflight blackbox log analysis: time-series and spectra, PID terms, step response (via Wiener deconvolution), latency, GPS track, scorecard, and related diagnostics — load `.bbl`/`.bfl` directly with no heavyweight desktop stack.

**PIDTuna** aims to be a simpler, lighter, easier-to-run alternative to [PIDToolbox](https://github.com/bw1129/PIDtoolbox), while staying **free and open source** under [GNU AGPL v3](LICENSE).

The app ships in three forms:

- **Hosted web app** — live at **<https://manwe-777.github.io/pid-tuna/>**. Auto-deploys on every push to `main`.
- **Installable PWA** — load the hosted site (or any production build) and Chrome / Edge / Safari offer **Install** — the app then runs as a standalone window with full offline support.
- **Desktop app (Tauri 2)** — native installers for macOS (universal), Windows, and Linux. Attached to each tagged GitHub Release.

---

## Quick start (web dev)

```bash
pnpm install
pnpm dev
```

Vite serves the app at `http://localhost:5173/` by default. The page reloads on file changes.

Other web commands:

```bash
pnpm build       # type-check, then produce dist/ with PWA assets (service worker, manifest, icons)
pnpm preview     # serve the production build locally on :4173
pnpm typecheck   # TypeScript only, no build output
```

---

## Desktop app (Tauri 2)

The desktop wrapper packages the same web app into a native window. Prerequisites:

- **Rust toolchain** — install from <https://rustup.rs/> (one-time, persistent across projects).
- **Platform deps** — macOS needs Xcode Command Line Tools (`xcode-select --install`); Windows needs the C++ Build Tools or Visual Studio with the "Desktop development with C++" workload; Linux needs `libwebkit2gtk-4.0-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`, and the usual `build-essential`.

### Run the desktop app in dev mode

```bash
pnpm tauri:dev
```

Cargo compiles the Rust side (first run ~2 min; subsequent runs are seconds), Vite starts on `:5173`, then the Tauri window opens pointing at it. Hot reload from the web side works through the window — edit a `.tsx` / `.css` file and it reflects live. To open DevTools inside the Tauri window, press **⌘+⌥+I** on macOS or **Ctrl+Shift+I** on Linux/Windows.

### Build a production installer locally

```bash
pnpm tauri:build
```

This runs `pnpm build` first (which produces `dist/`), then compiles Rust in `--release` mode and bundles installers. Outputs land in `src-tauri/target/release/bundle/`:

| Platform | Default output(s) |
|---|---|
| macOS  | `bundle/dmg/PIDTuna_<version>_<arch>.dmg`, `bundle/macos/PIDTuna.app` |
| Windows | `bundle/msi/PIDTuna_<version>_x64_en-US.msi`, `bundle/nsis/PIDTuna_<version>_x64-setup.exe` |
| Linux  | `bundle/appimage/PIDTuna_<version>_amd64.AppImage`, `bundle/deb/...deb`, `bundle/rpm/...rpm` |

For a macOS universal (Intel + Apple Silicon) binary:

```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
pnpm tauri:build -- --target universal-apple-darwin
```

The first `tauri:build` is slow (Cargo compiles ~600 crates). Subsequent rebuilds are incremental and take seconds. The Rust target directory (`src-tauri/target/`) is cached locally and ignored by git.

> **Cross-compilation note:** Tauri doesn't reliably cross-compile installers. To build for all three OSes from one machine, use the GitHub Actions matrix (below) instead of doing it locally.

### Testing changes

PIDTuna has no automated test suite right now. To verify a change locally:

1. **`pnpm typecheck`** — catches TypeScript errors.
2. **`pnpm build`** — catches bundler errors (production-mode rollup).
3. **`pnpm dev`** — load a `.bbl`/`.bfl` log via the sidebar's *Add log* button and exercise the relevant tab.
4. **`pnpm tauri:dev`** — same end-to-end exercise, but inside the desktop window (catches WKWebView-specific issues that the browser misses, like the file-picker dialog path).

If you've touched DSP code under `src/dsp/`, a sanity check on the algorithm output is usually fastest with a small Node harness (see how `test-wiener.mjs` is used during DSP iteration — write one, run it on `LOG00004.BFL`, delete it).

---

## Releases (automated cross-platform installers)

The repo ships with a GitHub Actions workflow that builds **macOS-universal**, **Windows x64**, and **Linux x64** installers in parallel and attaches them to a GitHub Release.

### Cutting a release

```bash
git tag v0.1.0
git push origin v0.1.0
```

That tag push triggers `.github/workflows/build.yml` and, once the three platform builds finish (~10–15 min cold, faster with cache), you'll find a **draft GitHub Release** named `PIDTuna v0.1.0` on the Releases page with all the platform installers already uploaded:

```
PIDTuna_0.1.0_universal.dmg          (macOS universal)
PIDTuna_0.1.0_universal.app.tar.gz   (macOS universal, .app bundle for auto-updater)
PIDTuna_0.1.0_x64_en-US.msi          (Windows installer)
PIDTuna_0.1.0_x64-setup.exe          (Windows NSIS installer)
PIDTuna_0.1.0_amd64.AppImage         (Linux portable)
PIDTuna_0.1.0_amd64.deb              (Debian / Ubuntu)
PIDTuna-0.1.0-1.x86_64.rpm           (Fedora / RHEL)
```

Edit the release notes in the GitHub UI, then click **Publish release** to make it visible. Versions come from `package.json`, which `tauri.conf.json` reads via `"version": "../package.json"` — bump the version there before tagging.

### Building installers without making a release

If you just want a one-off build (e.g., to test the workflow before tagging, or to share a beta build privately), use the manual trigger:

1. Go to the **Actions** tab on GitHub.
2. Open **"Build desktop bundles"** in the left sidebar.
3. Click **Run workflow** → pick a branch → **Run workflow**.

When the run finishes, scroll to the **Artifacts** section at the bottom of the run summary. Three artifacts (`pidtuna-macos-latest`, `pidtuna-ubuntu-22.04`, `pidtuna-windows-latest`) are downloadable for 14 days. No release is created.

### Versioning

PIDTuna follows [semver](https://semver.org/): `MAJOR.MINOR.PATCH`.

- **MAJOR** — breaking changes (log-parsing schema, scorecard rubric, public DSP function signatures).
- **MINOR** — new features, additive changes to the UI / DSP.
- **PATCH** — bug fixes, internal cleanups, docs.

The version is stored in `package.json` and consumed in three places automatically:

- the web UI (visible in the top-right of the global header — click it to jump to that version's release notes)
- the Tauri bundle (`tauri.conf.json` reads `../package.json`)
- the Rust crate (`src-tauri/Cargo.toml` — bump in sync; CI verifies on tag pushes)

To cut a release, bump all three and tag:

```bash
# package.json: 0.1.0 -> 0.2.0
# src-tauri/Cargo.toml: 0.1.0 -> 0.2.0
git commit -am "chore: release v0.2.0"
git tag v0.2.0
git push && git push --tags
```

### Code signing (optional)

The released installers are **unsigned by default**. macOS will show "PIDTuna can't be opened because it is from an unidentified developer" — users right-click → **Open** to bypass. Windows shows a SmartScreen warning users can dismiss.

To sign releases, add these repo secrets and `tauri-action` will pick them up automatically:

- **macOS**: `APPLE_CERTIFICATE` (base64-encoded .p12), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD` (app-specific password), `APPLE_TEAM_ID`.
- **Windows**: `WINDOWS_CERTIFICATE` (base64-encoded .pfx), `WINDOWS_CERTIFICATE_PASSWORD`.

No code signing certificate? Skip this — the unsigned flow works, just with the OS warnings above.

---

## Continuous integration

A separate `.github/workflows/ci.yml` runs on every push and pull request:

- `pnpm typecheck`
- `pnpm build` (web bundle, validates PWA + Rollup)

This is the cheap, fast check (Ubuntu only, no Rust compile). The heavier `build.yml` only runs on tag pushes and manual dispatches because compiling Rust across three OSes is slow and expensive.

---

## Hosted web build (GitHub Pages)

Every push to `main` deploys the production web bundle to **<https://manwe-777.github.io/pid-tuna/>** via `.github/workflows/pages.yml`. The workflow builds with `VITE_BASE_PATH=/pid-tuna/` so all asset paths and the PWA manifest's `scope` / `start_url` correctly point under the project-page subpath.

### One-time repo setup

In the GitHub UI: **Settings → Pages → Source → "GitHub Actions"** (not "Deploy from a branch"). The workflow handles building and publishing — no `gh-pages` branch or `dist/` commits required.

### Local preview at the same base path

```bash
VITE_BASE_PATH=/pid-tuna/ pnpm build
pnpm preview
```

…then open `http://localhost:4173/pid-tuna/`. Useful when debugging the Pages build before pushing.

The Pages build also copies `dist/index.html` to `dist/404.html` so direct hits to any subpath load the app rather than GitHub's default 404 page — relevant if you ever add client-side routing.
