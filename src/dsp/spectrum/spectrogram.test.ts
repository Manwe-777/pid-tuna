import { describe, expect, test } from 'vitest';

import { computeBinnedSpectrogram } from './computeBinnedSpectrogram';
import { computePsd } from './computePsd';
import { computeSpectrogram } from './computeSpectrogram';

const FS = 2000;
const tone = (n: number, hz: number, offset = 0) =>
  Float32Array.from({ length: n }, (_, i) => offset + Math.sin((2 * Math.PI * hz * i) / FS));

describe('power spectra', () => {
  test('a constant offset does not raise the low-frequency bins', () => {
    const plain = computePsd(tone(20000, 150), FS);
    const offset = computePsd(tone(20000, 150, 300), FS);
    const bin = plain.frequencies.findIndex((f) => f > 1);
    expect(offset.psdDb[bin]!).toBeCloseTo(plain.psdDb[bin]!, 0);
  });

  test('a tone shows up at its own frequency', () => {
    const psd = computePsd(tone(20000, 150), FS);
    let peak = 0;
    for (let i = 1; i < psd.psdDb.length; i++) if (psd.psdDb[i]! > psd.psdDb[peak]!) peak = i;
    expect(Math.abs(psd.frequencies[peak]! - 150)).toBeLessThan(FS / 1024);
  });

  test('the binned heatmap uses the last full segment too', () => {
    const segment = Math.round(FS * 0.2);
    const signal = tone(segment * 2, 150);
    const domain = new Float32Array(signal.length);
    domain.fill(10, 0, segment);
    domain.fill(90, segment);
    const r = computeBinnedSpectrogram(signal, domain, FS, { bins: 10, domainWindow: 5, smoothRows: 1, smoothCols: 1 });
    const rowMax = (row: number) => Math.max(...r.magnitudes.slice(row * r.freqBins, (row + 1) * r.freqBins));
    expect(rowMax(8)).toBeGreaterThan(-80);
  });
});

describe('spectrogram time axis', () => {
  test('window times follow the log clock, not the nominal sample rate', () => {
    // A log that starts at 5 s and really runs 1% slower than its header rate.
    const n = 40000;
    const sampleTimes = Float32Array.from({ length: n }, (_, i) => 5 + (i / FS) * 1.01);
    const spec = computeSpectrogram(tone(n, 150), FS, { windowSize: 512, sampleTimes });
    const lastCentre = (spec.timeBins - 1) * 256 + 256;
    expect(spec.times[0]).toBeCloseTo(sampleTimes[256]!, 4);
    expect(spec.times[spec.timeBins - 1]).toBeCloseTo(sampleTimes[lastCentre]!, 4);
  });

  test('without timestamps, windows count samples from zero', () => {
    const spec = computeSpectrogram(tone(4096, 150), FS, { windowSize: 512 });
    expect(spec.times[0]).toBeCloseTo(256 / FS, 6);
    expect(spec.halfWindowSec).toBeCloseTo(256 / FS, 6);
  });
});
