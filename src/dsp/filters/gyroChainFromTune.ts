import type { FilterDelayContext, FilterSpec, FilterType, TuneView } from '../../types';
import { newFilterId } from './newFilterId';

const LPF_TYPE: Record<number, FilterType> = { 0: 'pt1', 1: 'biquad', 2: 'pt2', 3: 'pt3' };
const DEFAULT_RPM_FADE_HZ = 50;

/**
 * The log's gyro filters as a simulator chain, placed the same way as the
 * delay breakdown: a dynamic lowpass at its minimum cutoff, RPM notches at the
 * median motor frequency (or minimum + fade range), dynamic notches at their
 * minimum frequency.
 */
export function gyroChainFromTune(view: TuneView, ctx: FilterDelayContext = {}): FilterSpec[] {
  const chain: FilterSpec[] = [];
  const base = { id: '', enabled: true, bandwidth: 40 };
  const push = (spec: Omit<FilterSpec, 'id'>) => chain.push({ ...spec, id: newFilterId() });

  const lpf = (hz: number | undefined, type: number | undefined) => {
    if (hz && hz > 0) push({ ...base, type: LPF_TYPE[type ?? 0] ?? 'pt1', cutoffHz: hz });
  };

  const notch = (hz: number | undefined, cutoff: number | undefined) => {
    // Betaflight's Q = centre·cutoff / (centre² − cutoff²); the simulator uses Q = centre / bandwidth.
    if (hz && cutoff && hz > cutoff && cutoff > 0)
      push({ ...base, type: 'notch', cutoffHz: hz, bandwidth: (hz * hz - cutoff * cutoff) / cutoff });
  };

  lpf(view.gyroDynRange?.min ?? view.gyroLpf1Hz, view.gyroLpf1Type);
  lpf(view.gyroLpf2Hz, view.gyroLpf2Type);
  notch(view.gyroNotch1Hz, view.gyroNotch1Cutoff);
  notch(view.gyroNotch2Hz, view.gyroNotch2Cutoff);

  const rpm = rpmSpec(view, ctx, base);
  if (rpm) push(rpm);

  const dynNotch = dynNotchSpec(view, base);
  if (dynNotch) push(dynNotch);

  return chain;
}

type BaseSpec = Pick<FilterSpec, 'enabled' | 'bandwidth'>;

/** RPM notches at the median motor frequency, or minimum + fade range; null when RPM filtering is off. */
function rpmSpec(view: TuneView, ctx: FilterDelayContext, base: BaseSpec): Omit<FilterSpec, 'id'> | null {
  if (!((view.rpmHarmonics ?? 0) > 0 && view.rpmMinHz != null)) return null;

  const fadeHz = view.rpmFadeHz ?? DEFAULT_RPM_FADE_HZ;

  return {
    ...base,
    type: 'rpm',
    cutoffHz: ctx.motorHz && ctx.motorHz > 0 ? Math.round(ctx.motorHz * 10) / 10 : view.rpmMinHz + fadeHz,
    bfQ: view.rpmQ ?? 500,
    count: view.rpmHarmonics,
    minHz: view.rpmMinHz,
    fadeHz,
    weights: view.rpmWeights,
    motors: ctx.motorCount ?? 4,
  };
}

/** Dynamic notches at their minimum frequency; null when there are none. */
function dynNotchSpec(view: TuneView, base: BaseSpec): Omit<FilterSpec, 'id'> | null {
  if (!((view.dynNotchCount ?? 0) > 0 && view.dynNotchMin != null)) return null;

  return {
    ...base,
    type: 'dynNotch',
    cutoffHz: view.dynNotchMin,
    bfQ: view.dynNotchQ ?? 300,
    count: view.dynNotchCount,
  };
}
