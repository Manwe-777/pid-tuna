import type { TuneView } from '../tuneView';
import type { BfFilterKind } from './bfFilterSections';
import type { FilterPart } from './filterPart';
import { notchQFromCutoff } from './notchQFromCutoff';
import { partsDelay } from './partsDelay';
import { rpmNotchParts } from './rpmNotchParts';

/** Default frequency delay is reported at: inside the control band, and PIDtoolbox's default. */
export const DELAY_REFERENCE_HZ = 25;

export type FilterChain = 'gyro' | 'dterm';

export interface FilterDelayEntry {
  label: string;
  chain: FilterChain;
  /** Cutoff (lowpass) or centre (notch) used for the calculation, Hz. */
  cutoffHz: number;
  type: string;
  /** Phase delay at the reference frequency, ms. */
  delayMs: number;
  /** Phase lag at the reference frequency, degrees. */
  phaseDeg: number;
  /** The cutoff moves in flight; the value shown is the stated worst or typical case. */
  dynamic: boolean;
  note?: string;
}

export interface FilterDelayBreakdown {
  referenceHz: number;
  entries: FilterDelayEntry[];
  /** Delay every PID term sees: the gyro filters. */
  gyroDelayMs: number;
  /** Delay the D term sees: gyro filters plus D-term filters. */
  dPathDelayMs: number;
}

export interface FilterDelayContext {
  motorCount?: number;
  /** Median motor fundamental in flight, Hz, when RPM telemetry is logged. */
  motorHz?: number;
  /** Frequency the delay is reported at. Default DELAY_REFERENCE_HZ. */
  referenceHz?: number;
}

const LPF_KIND: Record<number, BfFilterKind> = { 0: 'pt1', 1: 'biquad', 2: 'pt2', 3: 'pt3' };
const LPF_LABEL: Record<BfFilterKind, string> = { pt1: 'PT1', biquad: 'Biquad', pt2: 'PT2', pt3: 'PT3', notch: 'Notch' };
const DEFAULT_MOTORS = 4;
const DEFAULT_RPM_FADE_HZ = 50;

/**
 * Per-filter phase delay at the reference frequency, computed with
 * Betaflight's own filter maths: gyro filters at the gyro loop rate, D-term
 * filters at the PID loop rate.
 */
export function computeFilterDelays(view: TuneView, ctx: FilterDelayContext = {}): FilterDelayBreakdown {
  const referenceHz = ctx.referenceHz ?? DELAY_REFERENCE_HZ;
  const gyroHz = view.gyroRateHz ?? 8000;
  const pidHz = view.pidRateHz ?? gyroHz;
  const entries: FilterDelayEntry[] = [];
  const add = (e: Omit<FilterDelayEntry, 'delayMs' | 'phaseDeg'>, parts: FilterPart[], loopHz: number) => {
    const { delayMs, phaseDeg } = partsDelay(parts, loopHz, referenceHz);
    if (parts.length > 0) entries.push({ ...e, delayMs, phaseDeg });
  };

  lowpass(add, 'Gyro LPF 1', 'gyro', view.gyroDynRange?.min ?? view.gyroLpf1Hz, view.gyroLpf1Type, gyroHz, view.gyroDynRange != null);
  lowpass(add, 'Gyro LPF 2', 'gyro', view.gyroLpf2Hz, view.gyroLpf2Type, gyroHz, false);
  staticNotch(add, 'Gyro notch 1', 'gyro', view.gyroNotch1Hz, view.gyroNotch1Cutoff, gyroHz);
  staticNotch(add, 'Gyro notch 2', 'gyro', view.gyroNotch2Hz, view.gyroNotch2Cutoff, gyroHz);
  rpmFilter(add, view, gyroHz, ctx);
  dynamicNotch(add, view, gyroHz);

  lowpass(add, 'D-term LPF 1', 'dterm', view.dtermDynRange?.min ?? view.dtermLpf1Hz, view.dtermLpf1Type, pidHz, view.dtermDynRange != null);
  lowpass(add, 'D-term LPF 2', 'dterm', view.dtermLpf2Hz, view.dtermLpf2Type, pidHz, false);
  staticNotch(add, 'D-term notch', 'dterm', view.dtermNotchHz, view.dtermNotchCutoff, pidHz);

  const gyroDelayMs = sumDelay(entries, 'gyro');

  return { referenceHz, entries, gyroDelayMs, dPathDelayMs: gyroDelayMs + sumDelay(entries, 'dterm') };
}

type Add = (e: Omit<FilterDelayEntry, 'delayMs' | 'phaseDeg'>, parts: FilterPart[], loopHz: number) => void;

function lowpass(
  add: Add,
  label: string,
  chain: FilterChain,
  hz: number | undefined,
  typeId: number | undefined,
  loopHz: number,
  dynamic: boolean,
): void {
  if (!hz || hz <= 0) return;

  const kind = LPF_KIND[typeId ?? 0] ?? 'pt1';
  add(
    { label, chain, cutoffHz: hz, type: LPF_LABEL[kind], dynamic, note: dynamic ? 'at its minimum cutoff (most delay)' : undefined },
    [{ kind, hz }],
    loopHz,
  );
}

function staticNotch(add: Add, label: string, chain: FilterChain, hz: number | undefined, cutoff: number | undefined, loopHz: number): void {
  if (!hz || hz <= 0 || !cutoff || cutoff <= 0 || cutoff >= hz) return;

  const q = notchQFromCutoff(hz, cutoff);
  add({ label, chain, cutoffHz: hz, type: `Notch Q ${q.toFixed(1)}`, dynamic: false }, [{ kind: 'notch', hz, q }], loopHz);
}

function rpmFilter(add: Add, view: TuneView, loopHz: number, ctx: FilterDelayContext): void {
  const harmonics = view.rpmHarmonics ?? 0;
  if (harmonics <= 0 || view.rpmMinHz == null) return;

  const q = (view.rpmQ ?? 500) / 100;
  const fadeHz = view.rpmFadeHz ?? DEFAULT_RPM_FADE_HZ;
  const motors = ctx.motorCount ?? DEFAULT_MOTORS;
  const measured = ctx.motorHz != null && ctx.motorHz > 0;
  const fundamental = measured ? ctx.motorHz! : view.rpmMinHz + fadeHz;

  add(
    {
      label: `RPM filter (${harmonics} harmonics × ${motors} motors)`,
      chain: 'gyro',
      cutoffHz: Math.round(fundamental),
      type: `Notch Q ${q.toFixed(1)}`,
      dynamic: true,
      note: measured ? 'at the median motor frequency in this log' : 'at minimum + fade range (no RPM telemetry)',
    },
    rpmNotchParts(fundamental, harmonics, q, view.rpmMinHz, fadeHz, view.rpmWeights, motors, loopHz),
    loopHz,
  );
}

function dynamicNotch(add: Add, view: TuneView, loopHz: number): void {
  const count = view.dynNotchCount ?? 0;
  if (count <= 0 || view.dynNotchMin == null) return;

  const q = (view.dynNotchQ ?? 300) / 100;
  add(
    {
      label: `Dynamic notch (×${count})`,
      chain: 'gyro',
      cutoffHz: view.dynNotchMin,
      type: `Notch Q ${q.toFixed(1)}`,
      dynamic: true,
      note: 'at its minimum frequency (most delay)',
    },
    [{ kind: 'notch', hz: view.dynNotchMin, q, copies: count }],
    loopHz,
  );
}

function sumDelay(entries: FilterDelayEntry[], chain: FilterChain): number {
  return entries.filter((e) => e.chain === chain).reduce((s, e) => s + e.delayMs, 0);
}
