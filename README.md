<p align="center">
  <img src="public/pidtuna-wordmark.svg" alt="PIDTuna" width="320" />
</p>

<p align="center">
  <a href="https://github.com/Manwe-777/pid-tuna/actions/workflows/main.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/Manwe-777/pid-tuna/main.yml?branch=main&label=CI&style=flat-square"></a>
  <a href="https://manwe-777.github.io/pid-tuna/"><img alt="Web app" src="https://img.shields.io/badge/web-manwe--777.github.io%2Fpid--tuna-6666ff?style=flat-square"></a>
  <a href="https://github.com/Manwe-777/pid-tuna/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/Manwe-777/pid-tuna?style=flat-square&label=release"></a>
  <a href="LICENSE"><img alt="License: AGPL-3.0" src="https://img.shields.io/github/license/Manwe-777/pid-tuna?style=flat-square"></a>
</p>

Betaflight blackbox log analysis in the browser: step response, noise spectra, filter delay, tracking latency, motor balance, battery, GPS and a tune scorecard. Load a `.bbl` or `.bfl` file at [manwe-777.github.io/pid-tuna](https://manwe-777.github.io/pid-tuna/), install it as an offline app, or use the desktop build from the [releases](https://github.com/Manwe-777/pid-tuna/releases).

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
