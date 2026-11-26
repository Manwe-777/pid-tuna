import { describe, expect, test } from 'vitest';

import { mulberry32 } from '../mulberry32';
import { motorHarmonicNoise } from './motorHarmonicNoise';

const FS = 4000;
const SECONDS = 20;

/** Motor speeding up from 150 to 300 Hz; gyro has tones at its harmonics with the given amplitudes plus white noise. */
function flight(amplitudes: number[], noise = 0.05) {
  const n = FS * SECONDS;
  const motor = Float32Array.from({ length: n }, (_, i) => 150 + (150 * i) / n);
  const rand = mulberry32(9);
  const gyro = new Float32Array(n);
  let phase = 0;

  for (let i = 0; i < n; i++) {
    phase += (2 * Math.PI * motor[i]!) / FS;
    let v = (rand() - 0.5) * 2 * noise;
    amplitudes.forEach((a, h) => {
      v += a * Math.sin((h + 1) * phase);
    });
    gyro[i] = v;
  }

  return { gyro, motors: [motor, motor, motor, motor] };
}

describe('noise at motor harmonics', () => {
  test('a harmonic ten times stronger reads about 20 dB higher', () => {
    const f = flight([1, 0.1, 0]);
    const [h1, h2] = motorHarmonicNoise(f.gyro, f.motors, FS);
    expect(h1!.meanDb! - h2!.meanDb!).toBeGreaterThan(18);
    expect(h1!.meanDb! - h2!.meanDb!).toBeLessThan(22);
  });

  test('a harmonic that is not there reads near the noise floor, far below the real ones', () => {
    const f = flight([1, 0, 0]);
    const [h1, h2] = motorHarmonicNoise(f.gyro, f.motors, FS);
    expect(h1!.meanDb! - h2!.meanDb!).toBeGreaterThan(40);
  });

  test('the level stays steady while the motors speed up, because the search follows them', () => {
    const f = flight([1, 0, 0]);
    expect(motorHarmonicNoise(f.gyro, f.motors, FS)[0]!.sdDb!).toBeLessThan(1.5);
  });

  test('without spinning motors there is nothing to measure', () => {
    const f = flight([1, 0, 0]);
    const stopped = f.motors.map((m) => new Float32Array(m.length));
    expect(motorHarmonicNoise(f.gyro, stopped, FS).every((h) => h.meanDb == null)).toBe(true);
  });

  test('harmonics above Nyquist are skipped', () => {
    const f = flight([1, 0, 0]);
    const fast = f.motors.map((m) => m.map((v) => v * 6));
    expect(motorHarmonicNoise(f.gyro, fast, FS, { harmonics: 3 })[2]!.meanDb).toBeNull();
  });
});
