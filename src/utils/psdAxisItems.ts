import { combinePsds } from '../dsp/spectrum/combinePsds';
import { computePsd } from '../dsp/spectrum/computePsd';
import type { LogEntry, LogSlot, PsdAxisItem, PsdResult, SignalDef } from '../types';
import { extractSignal } from './extractSignal';
import { makeMergedSlot } from './makeMergedSlot';
import { resampleY } from './resampleY';

type LogPsd = { slot: LogSlot; dash: number[]; psd: PsdResult };

/** PSDs of the other logs, resampled onto the primary log's frequency grid. */
function otherLogPsds(entries: LogEntry[], def: SignalDef, axis: number, windowSize: number, grid: Float32Array) {
  const out: LogPsd[] = [];

  for (const e of entries.slice(1)) {
    const sig = extractSignal(e.log, def.key, axis);
    if (!sig || sig.length === 0) continue;
    const psd = computePsd(sig, e.log.setup.sampleRateHz, { windowSize });
    if (psd.numWindows === 0) continue;
    const resampled = resampleY(psd.frequencies, psd.psdDb, grid);
    out.push({ slot: e.slot, dash: e.dash, psd: { frequencies: grid, psdDb: resampled, numWindows: psd.numWindows } });
  }

  return out;
}

/** One signal's item, or null when the primary log lacks it. */
function psdItem(entries: LogEntry[], def: SignalDef, axis: number, windowSize: number, merge: boolean) {
  const primary = entries[0]!;
  const primarySig = extractSignal(primary.log, def.key, axis);
  if (!primarySig || primarySig.length === 0) return null;
  const primaryPsd = computePsd(primarySig, primary.log.setup.sampleRateHz, { windowSize });
  if (primaryPsd.numWindows === 0) return null;

  // Full PsdResults (numWindows + dB) are kept so "Merge logs" can do a weighted Welch-style merge.
  const perLogPsds: LogPsd[] = [
    { slot: primary.slot, dash: primary.dash, psd: primaryPsd },
    ...otherLogPsds(entries, def, axis, windowSize, primaryPsd.frequencies),
  ];

  if (merge) {
    const merged = combinePsds(perLogPsds.map((p) => p.psd));

    return {
      def,
      freq: primaryPsd.frequencies,
      perLog: [{ slot: makeMergedSlot(entries), dash: [], psd: merged.psdDb }],
    };
  }

  return {
    def,
    freq: primaryPsd.frequencies,
    perLog: perLogPsds.map(({ slot, dash, psd }) => ({ slot, dash, psd: psd.psdDb })),
  };
}

/** PSD items for the selected signals on one axis, skipping signals the primary log doesn't have. */
export function psdAxisItems(
  entries: LogEntry[],
  defs: SignalDef[],
  axis: number,
  windowSize: number,
  merge: boolean,
): PsdAxisItem[] {
  return defs.flatMap((def) => psdItem(entries, def, axis, windowSize, merge) ?? []);
}
