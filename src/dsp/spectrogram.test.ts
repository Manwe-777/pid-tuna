import { describe, expect, test } from 'vitest';

import { computeBinnedSpectrogram, computePsd } from './spectrogram';

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
