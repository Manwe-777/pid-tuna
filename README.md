# PIDTuna

Browser-based Betaflight blackbox log analysis: time-series and spectra, PID terms, step response, latency, GPS track, and related diagnostics — load `.bbl`/`.bfl` directly with no heavyweight desktop stack.

**PIDTuna** aims to be a simpler, lighter, easier-to-run alternative to [PIDToolbox](https://github.com/bw1129/PIDtoolbox), while staying **free and open source** under [GNU AGPL v3](LICENSE).

## Quick start

```bash
pnpm install
pnpm dev
```

Then open the URL Vite prints (default port `5173`). Use **build** / **preview** for production bundles (`pnpm build`, `pnpm preview`).
