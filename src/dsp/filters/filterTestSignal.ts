import type { ChirpOptions, FilterSpec, TestSignalKind, TestSignalResult } from '../../types';
import { applyFilterChain } from './applyFilterChain';
import { mulberry32 } from '../mulberry32';

const STEP_SECONDS = 0.5;

/**
 * Run a synthetic signal through the filter chain at the loop rate: a unit
 * step, a unit impulse, or a linear chirp sin(2π(f₀t + (f₁ − f₀)t²/2T)) with
 * optional noise. Shows ringing, settling and delay in the time domain.
 */
export function filterTestSignal(
  chain: ReadonlyArray<FilterSpec>,
  loopHz: number,
  kind: TestSignalKind,
  chirp: ChirpOptions = { startHz: 0, endHz: 1000, duration: 1 },
): TestSignalResult {
  const seconds = kind === 'chirp' ? chirp.duration : STEP_SECONDS;
  const n = Math.max(2, Math.round(seconds * loopHz) + (kind === 'chirp' ? 0 : 1));
  const input = new Float32Array(n);
  const timeMs = Float32Array.from({ length: n }, (_, i) => (i / loopHz) * 1000);

  if (kind === 'step') input.fill(1);
  else if (kind === 'impulse') input[0] = 1;
  else fillChirp(input, loopHz, chirp);

  return { timeMs, input, output: applyFilterChain(input, loopHz, chain) };
}

function fillChirp(out: Float32Array, loopHz: number, c: ChirpOptions): void {
  const rand = mulberry32(12345);

  for (let i = 0; i < out.length; i++) {
    const t = i / loopHz;
    out[i] = Math.sin(2 * Math.PI * (c.startHz * t + ((c.endHz - c.startHz) * t * t) / (2 * c.duration)));
  }

  if (!c.noise) return;

  for (let i = 0; i < out.length; i += 2) {
    const u = Math.max(rand(), 1e-12);
    const v = rand();
    const r = Math.sqrt(-2 * Math.log(u)) * c.noise;
    out[i] = out[i]! + r * Math.cos(2 * Math.PI * v);
    if (i + 1 < out.length) out[i + 1] = out[i + 1]! + r * Math.sin(2 * Math.PI * v);
  }
}
