import { describe, expect, test } from 'vitest';
import { DELAY_REFERENCE_HZ } from '../../constants';
import type { FilterSpec, TuneView } from '../../types';
import { applyFilterChain } from './applyFilterChain';
import { computeFilterChainResponse } from './computeFilterChainResponse';
import { computeFilterDelays } from './computeFilterDelays';
import { gyroChainFromTune } from './gyroChainFromTune';
import { notchQFromCutoff } from './notchQFromCutoff';

const FS = 4000;
const spec = (type: FilterSpec['type'], cutoffHz: number, bandwidth = 40): FilterSpec => ({
  id: type,
  enabled: true,
  type,
  cutoffHz,
  bandwidth,
});

function sineGainDb(chain: FilterSpec[], hz: number): number {
  const n = FS * 2;
  const x = Float32Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * hz * i) / FS));
  const y = applyFilterChain(x, FS, chain);
  const rms = (a: Float32Array) => Math.sqrt(a.slice(n / 2).reduce((s, v) => s + v * v, 0) / (n / 2));

  return 20 * Math.log10(rms(y) / rms(x));
}

describe('filter simulator', () => {
  test.each(['pt1', 'pt2', 'pt3', 'biquad'] as const)(
    'a %s applied to a sine attenuates it as its response curve says',
    (type) => {
      const chain = [spec(type, 150)];
      const curve = computeFilterChainResponse(chain, FS, Float32Array.of(400)).magnitudeDb[0]!;
      expect(sineGainDb(chain, 400)).toBeCloseTo(curve, 1);
    },
  );

  test('a notch removes a tone at its centre', () => {
    expect(sineGainDb([spec('notch', 200, 40)], 200)).toBeLessThan(-30);
  });

  test('a disabled filter changes nothing', () => {
    const x = Float32Array.from({ length: 100 }, (_, i) => Math.sin(i));
    expect(Array.from(applyFilterChain(x, FS, [{ ...spec('pt1', 50), enabled: false }]))).toEqual(Array.from(x));
  });

  test('phase delay of a PT1 at 30 Hz is close to its 0 Hz group delay when the cutoff is well above 30 Hz', () => {
    const d = computeFilterChainResponse([spec('pt1', 300)], 8000, Float32Array.of(30)).phaseDelayMs[0]!;
    expect(d).toBeCloseTo(1000 / (2 * Math.PI * 300), 1);
  });
});

describe('loading the log’s gyro filters into the simulator', () => {
  const base = {
    hasPid: false,
    pidByAxis: [],
    hasRates: false,
    rcRates: [],
    rcExpo: [],
    superRates: [],
    rpmWeights: [],
  } as TuneView;

  test('a dynamic lowpass loads at its minimum cutoff with its type', () => {
    const chain = gyroChainFromTune({
      ...base,
      gyroDynRange: { min: 250, max: 500 },
      gyroLpf1Type: 2,
      gyroLpf2Hz: 500,
    });
    expect(chain.map((f) => [f.type, f.cutoffHz])).toEqual([
      ['pt2', 250],
      ['pt1', 500],
    ]);
  });

  test('the loaded chain delays exactly as much as the gyro path in the delay breakdown', () => {
    const view: TuneView = {
      ...base,
      gyroRateHz: 8000,
      gyroDynRange: { min: 250, max: 500 },
      gyroLpf2Hz: 500,
      rpmHarmonics: 3,
      rpmMinHz: 100,
      rpmQ: 500,
      rpmFadeHz: 50,
      rpmWeights: [90, 30, 90],
      dynNotchCount: 2,
      dynNotchMin: 150,
      dynNotchQ: 300,
    };
    const ctx = { motorHz: 180, motorCount: 4 };
    const sim = computeFilterChainResponse(gyroChainFromTune(view, ctx), 8000, Float32Array.of(DELAY_REFERENCE_HZ))
      .phaseDelayMs[0]!;
    expect(sim).toBeCloseTo(computeFilterDelays(view, ctx).gyroDelayMs, 6);
  });

  test('a static notch keeps the Q Betaflight would give it', () => {
    const [notch] = gyroChainFromTune({ ...base, gyroNotch1Hz: 300, gyroNotch1Cutoff: 200 });
    expect(notch!.cutoffHz / notch!.bandwidth).toBeCloseTo(notchQFromCutoff(300, 200), 6);
  });
});
