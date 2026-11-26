import type { ParsedLog } from '../../types';

/** A minimal ParsedLog around one axis of simulated data (roll), for analyses that take a whole log. `throttle` is stick %. */
export function syntheticLog(setpoint: Float32Array, gyro: Float32Array, throttle: Float32Array, sampleRateHz: number): ParsedLog {
  const n = setpoint.length;
  const zeros = new Float32Array(n);

  return {
    time: Float32Array.from({ length: n }, (_, i) => i / sampleRateHz),
    setpoint: [setpoint, zeros, zeros, throttle.map((t) => t * 10)],
    rcCommand: [zeros, zeros, zeros, throttle.map((t) => 1000 + t * 10)],
    gyroFilt: [gyro, zeros, zeros],
    motor: [],
    eRpm: [],
    setup: { looptimeUs: 1e6 / sampleRateHz, sampleRateHz, rawHeaders: {} },
  } as unknown as ParsedLog;
}
