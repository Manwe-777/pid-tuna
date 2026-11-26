import { M_PER_DEG_LAT } from '../../constants';
import type { GpsMapSmoothSettings, V2 } from '../../types';
import { gpsCoordValid } from './gpsCoordValid';
import { toLatLon } from './toLatLon';
import { toXY } from './toXY';

function hannWeight(d: number, half: number): number {
  const ad = Math.abs(d);
  if (ad > half) return 0;
  return 0.5 * (1 + Math.cos((Math.PI * d) / half));
}

/**
 * Bidirectional exponential smoothing along each contiguous valid-fix span in local meters —
 * attenuates quantized latitude/longitude staircase motion at the latch rate.
 */
function bidirectionalEwmaMeterRuns(
  lat: Float32Array,
  lon: Float32Array,
  outLat: Float32Array,
  outLon: Float32Array,
  lambdaRaw: number,
): void {
  const n = lat.length;
  const λ = lambdaRaw;

  /** Grow-on-demand meter scratch (+ forward / backward EWMA halves). */
  let pool = new Float64Array(Math.min(8192, Math.max(256, n)));

  let iScan = 0;
  while (iScan < n) {
    while (iScan < n && !gpsCoordValid(lat[iScan]!, lon[iScan]!)) iScan++;
    const iStart = iScan;
    while (iScan < n && gpsCoordValid(lat[iScan]!, lon[iScan]!)) iScan++;
    const iEndExclusive = iScan;
    const runLen = iEndExclusive - iStart;
    if (runLen < 2) {
      for (let k = iStart; k < iEndExclusive; k++) {
        outLat[k] = lat[k]!;
        outLon[k] = lon[k]!;
      }
      continue;
    }

    let sumLat = 0;
    let sumLon = 0;
    for (let k = iStart; k < iEndExclusive; k++) {
      sumLat += lat[k]!;
      sumLon += lon[k]!;
    }
    const cLat = sumLat / runLen;
    const cLon = sumLon / runLen;
    const mPerDegLon = M_PER_DEG_LAT * Math.cos((cLat * Math.PI) / 180);

    if (pool.length < runLen * 6) pool = new Float64Array(runLen * 6);
    const rawX = pool.subarray(0, runLen);
    const rawY = pool.subarray(runLen, runLen * 2);
    const fwdX = pool.subarray(runLen * 2, runLen * 3);
    const fwdY = pool.subarray(runLen * 3, runLen * 4);
    const bkX = pool.subarray(runLen * 4, runLen * 5);
    const bkY = pool.subarray(runLen * 5, runLen * 6);

    for (let o = 0; o < runLen; o++) {
      const k = iStart + o;
      const m = toXY(lat[k]!, lon[k]!, cLat, cLon, mPerDegLon);
      rawX[o] = m.x;
      rawY[o] = m.y;
    }

    const oneMλ = 1 - λ;

    fwdX[0] = rawX[0]!;
    fwdY[0] = rawY[0]!;
    for (let o = 1; o < runLen; o++) {
      fwdX[o] = λ * rawX[o]! + oneMλ * fwdX[o - 1]!;
      fwdY[o] = λ * rawY[o]! + oneMλ * fwdY[o - 1]!;
    }

    const Lm1 = runLen - 1;
    bkX[Lm1] = rawX[Lm1]!;
    bkY[Lm1] = rawY[Lm1]!;
    for (let o = Lm1 - 1; o >= 0; o--) {
      bkX[o] = λ * rawX[o]! + oneMλ * bkX[o + 1]!;
      bkY[o] = λ * rawY[o]! + oneMλ * bkY[o + 1]!;
    }

    const halfBlend = 0.5;
    for (let o = 0; o < runLen; o++) {
      const xm = halfBlend * (fwdX[o]! + bkX[o]!);
      const ym = halfBlend * (fwdY[o]! + bkY[o]!);
      const p: V2 = { x: xm, y: ym };
      const k = iStart + o;
      const [qla, qlo] = toLatLon(p, cLat, cLon, mPerDegLon);
      outLat[k] = qla;
      outLon[k] = qlo;
    }

    /** Copy-forward path above already filled every `[iStart,iEndExclusive)` interior. */
  }
}

function smoothOnePass(
  srcLat: Float32Array,
  srcLon: Float32Array,
  dstLat: Float32Array,
  dstLon: Float32Array,
  halfWinCap: number,
  minRun: number,
): void {
  const n = srcLat.length;
  for (let k = 0; k < n; k++) {
    dstLat[k] = srcLat[k]!;
    dstLon[k] = srcLon[k]!;
  }

  let i = 0;
  while (i < n) {
    while (i < n && !gpsCoordValid(srcLat[i]!, srcLon[i]!)) i++;
    let j = i;
    while (j < n && gpsCoordValid(srcLat[j]!, srcLon[j]!)) j++;
    const runLen = j - i;
    if (runLen < minRun) {
      i = j;
      continue;
    }

    const half = Math.min(halfWinCap, Math.max(2, Math.floor(runLen / 3)));

    let sumLat = 0;
    let sumLon = 0;
    let kc = 0;
    for (let k = i; k < j; k++) {
      sumLat += srcLat[k]!;
      sumLon += srcLon[k]!;
      kc++;
    }
    const cLat = sumLat / kc;
    const cLon = sumLon / kc;
    const mPerDegLon = M_PER_DEG_LAT * Math.cos((cLat * Math.PI) / 180);

    for (let k = i; k < j; k++) {
      let sx = 0;
      let sy = 0;
      let sw = 0;
      for (let d = -half; d <= half; d++) {
        const idx = k + d;
        if (idx < i || idx >= j) continue;
        const w = hannWeight(d, half);
        sx += (srcLon[idx]! - cLon) * mPerDegLon * w;
        sy += (srcLat[idx]! - cLat) * M_PER_DEG_LAT * w;
        sw += w;
      }
      if (sw <= 1e-9) continue;
      const mx = sx / sw;
      const my = sy / sw;
      dstLon[k] = mx / mPerDegLon + cLon;
      dstLat[k] = my / M_PER_DEG_LAT + cLat;
    }

    i = j;
  }
}

/**
 * Map-only spatial smoothing: bidirectional EWMA in meters (against stair-step GEO noise), optional
 * light Hann afterward. Preserves invalid rows via the usual valid-fix mask from raw inputs.
 */
export function smoothLonLatForMap(
  lat: Float32Array,
  lon: Float32Array,
  settings: GpsMapSmoothSettings,
): {
  lat: Float32Array;
  lon: Float32Array;
} {
  const n = lat.length;
  if (n === 0 || lon.length !== n) return { lat, lon };

  if (!settings.spatialSmooth) {
    return { lat: Float32Array.from(lat), lon: Float32Array.from(lon) };
  }

  const outLat = new Float32Array(lat);
  const outLon = new Float32Array(lon);

  bidirectionalEwmaMeterRuns(lat, lon, outLat, outLon, settings.ewmaLambda);

  if (settings.hannPasses >= 1 && settings.hannHalfWinCap >= 2) {
    const effHalf = Math.max(2, Math.min(settings.hannHalfWinCap, 36));
    const minRun = Math.max(settings.minRunFloor, effHalf + 2);
    let aLat = outLat;
    let aLon = outLon;
    let bLat = new Float32Array(n);
    let bLon = new Float32Array(n);

    for (let p = 0; p < settings.hannPasses; p++) {
      smoothOnePass(aLat, aLon, bLat, bLon, effHalf, minRun);
      const tl = aLat;
      const tlo = aLon;
      aLat = bLat;
      aLon = bLon;
      bLat = tl;
      bLon = tlo;
    }

    return { lat: aLat, lon: aLon };
  }

  return { lat: outLat, lon: outLon };
}
