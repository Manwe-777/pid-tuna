import type { TuneView } from '../tuneView';
import { type FilterSpec, type FilterType, newFilterId } from './filters';

const LPF_TYPE: Record<number, FilterType> = { 0: 'pt1', 1: 'biquad', 2: 'pt2', 3: 'pt3' };

/**
 * The log's static gyro filters as a simulator chain. A dynamic lowpass is
 * placed at its minimum cutoff; RPM and dynamic notches move in flight and are
 * left out.
 */
export function gyroChainFromTune(view: TuneView): FilterSpec[] {
  const chain: FilterSpec[] = [];
  const lpf = (hz: number | undefined, type: number | undefined) => {
    if (hz && hz > 0) chain.push({ id: newFilterId(), enabled: true, type: LPF_TYPE[type ?? 0] ?? 'pt1', cutoffHz: hz, bandwidth: 40 });
  };
  const notch = (hz: number | undefined, cutoff: number | undefined) => {
    if (hz && cutoff && hz > cutoff && cutoff > 0) {
      // Betaflight's Q = centre·cutoff / (centre² − cutoff²); the simulator uses Q = centre / bandwidth.
      chain.push({ id: newFilterId(), enabled: true, type: 'notch', cutoffHz: hz, bandwidth: (hz * hz - cutoff * cutoff) / cutoff });
    }
  };

  lpf(view.gyroDynRange?.min ?? view.gyroLpf1Hz, view.gyroLpf1Type);
  lpf(view.gyroLpf2Hz, view.gyroLpf2Type);
  notch(view.gyroNotch1Hz, view.gyroNotch1Cutoff);
  notch(view.gyroNotch2Hz, view.gyroNotch2Cutoff);

  return chain;
}
