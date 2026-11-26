<p align="center">
  <img src="public/pidtuna-wordmark.svg" alt="PIDTuna" width="320" />
</p>

<p align="center">
  <img src="public/tunawaves.svg" alt="" width="520" />
</p>

<p align="center">
  <a href="https://github.com/Manwe-777/pid-tuna/actions/workflows/main.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/Manwe-777/pid-tuna/main.yml?branch=main&label=CI&style=flat-square"></a>
  <a href="https://manwe-777.github.io/pid-tuna/"><img alt="Web app" src="https://img.shields.io/badge/web-manwe--777.github.io%2Fpid--tuna-6666ff?style=flat-square"></a>
  <a href="https://github.com/Manwe-777/pid-tuna/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/Manwe-777/pid-tuna?style=flat-square&label=release"></a>
  <a href="LICENSE"><img alt="License: AGPL-3.0" src="https://img.shields.io/github/license/Manwe-777/pid-tuna?style=flat-square"></a>
  <a href="https://tauri.app/"><img alt="Built with Tauri 2" src="https://img.shields.io/badge/desktop-Tauri%202-24c8db?style=flat-square&logo=tauri&logoColor=white"></a>
</p>

<p align="center">
  <strong>👉 <a href="https://manwe-777.github.io/pid-tuna/">Try it now at manwe-777.github.io/pid-tuna</a></strong> — no install, drop a <code>.bbl</code>/<code>.bfl</code> in and go.
</p>

Betaflight blackbox log analysis in the browser: time series and spectra, PID terms, step response, filter delay, tracking latency, motor balance, battery, GPS track and a tune scorecard. Load `.bbl` or `.bfl` files directly, with no heavyweight desktop stack.

**PIDTuna** aims to be a simpler, lighter, easier-to-run alternative to [PIDtoolbox](https://github.com/ianrmurphy/PIDtoolbox), while staying **free and open source** under [GNU AGPL v3](LICENSE).

The app ships in three forms:

- **Hosted web app** at **<https://manwe-777.github.io/pid-tuna/>**, deployed on every release.
- **Installable PWA**: open the hosted site and Chrome, Edge or Safari offer **Install**; it then runs in its own window, fully offline.
- **Desktop app (Tauri 2)**: installers for macOS (universal), Windows and Linux on each [GitHub release](https://github.com/Manwe-777/pid-tuna/releases/latest).

## Run

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm tauri:dev    # desktop window (needs Rust and the Tauri 2 prerequisites)
```

## Test

```bash
pnpm test                                   # unit and accuracy tests
PIDTUNA_LOG_DIR=/path/to/logs pnpm test     # also the real-log tests
pnpm check                                  # typecheck, lint, format check, tests and build
```

## Build

```bash
pnpm build                                  # web app and PWA in dist/
VITE_BASE_PATH=/pid-tuna/ pnpm build        # as deployed to GitHub Pages
pnpm tauri:build                            # desktop installers in src-tauri/target/release/bundle/
```
