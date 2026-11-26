import type { ClosedLoopPlant } from './simulateClosedLoop';

/** Exact bandwidth and sensitivity peak of the simulated closed loop, from its transfer function. */
export function trueFrequencyMetrics(plant: ClosedLoopPlant, sampleRateHz: number) {
  const wn = 2 * Math.PI * plant.naturalHz;
  const tau = plant.delaySamples / sampleRateHz;
  let bandwidthHz = Number.NaN;
  let sensitivityPeakDb = -Infinity;
  let crossoverHz = Number.NaN;
  let phaseMarginDeg = Number.NaN;

  for (let f = 0.05; f <= 100; f += 0.05) {
    const w = 2 * Math.PI * f;
    const dRe = wn * wn - w * w;
    const dIm = 2 * plant.damping * wn * w;
    const den = dRe * dRe + dIm * dIm;
    const gRe = (wn * wn * dRe) / den;
    const gIm = (-wn * wn * dIm) / den;
    const tRe = gRe * Math.cos(w * tau) + gIm * Math.sin(w * tau);
    const tIm = gIm * Math.cos(w * tau) - gRe * Math.sin(w * tau);
    const magDb = 20 * Math.log10(Math.hypot(tRe, tIm));

    if (Number.isNaN(bandwidthHz) && f >= 1 && magDb <= -3) bandwidthHz = f;
    if (f >= 1) sensitivityPeakDb = Math.max(sensitivityPeakDb, 20 * Math.log10(Math.hypot(1 - tRe, -tIm)));

    const lDen = (1 - tRe) ** 2 + tIm ** 2;
    const lRe = (tRe * (1 - tRe) - tIm * tIm) / lDen;
    const lIm = tIm / lDen;
    if (Number.isNaN(crossoverHz) && f >= 1 && Math.hypot(lRe, lIm) < 1) {
      crossoverHz = f;
      phaseMarginDeg = 180 + (Math.atan2(lIm, lRe) * 180) / Math.PI;
      if (phaseMarginDeg > 360) phaseMarginDeg -= 360;
    }
  }

  return { bandwidthHz, sensitivityPeakDb, crossoverHz, phaseMarginDeg };
}
