import { rpmAxisMax } from '../dsp/spectrum/rpmAxisMax';

/** Motor rotation frequency (Hz) from RPM, with the axis maximum, or null without eRPM telemetry. */
export function rpmHzDomain(rpm: Float32Array | null): { series: Float32Array; max: number } | null {
  if (!rpm) return null;
  const series = new Float32Array(rpm.length);
  for (let i = 0; i < rpm.length; i++) series[i] = rpm[i]! / 60;

  return { series, max: rpmAxisMax(rpm) / 60 };
}
