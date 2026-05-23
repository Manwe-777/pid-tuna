import { gpsCoordValid } from './gpsPlayback';

const M_PER_DEG_LAT = 111320;

/** Map ground-track appearance only — time-series altitude/speed stay raw. */
export interface GpsMapSmoothSettings {
  /** When false, lat/lon are copied unchanged (CRS step count still applies visually). */
  spatialSmooth: boolean;
  /**
   * Forward EWMA blend factor per sample (`Sᵢ = λ·rᵢ + (1−λ)·Sᵢ₋₁` in meters).
   * Low λ ⇒ strong low-pass ⇒ softens quantized “stair” lat/lon; high λ ⇒ follows raw fixes.
   * Ignored when `spatialSmooth` is false.
   */
  ewmaLambda: number;
  /** Optional Hann pass after EWMA for final polish — 0 to skip. */
  hannPasses: number;
  hannHalfWinCap: number;
  minRunFloor: number;
  /**
   * Catmull–Rom subdivisions per latch chord (− 1 interpolation steps).
   * `≤ 1` → straight chords through smoothed knots.
   */
  crsChordSteps: number;
}

/**
 * Position on the internal `[0,1]` smoothing scale (~8%). Used only by {@link gpsDefaultMapSmoothSettings}.
 */
export const GPS_MAP_DEFAULT_LIGHT_KNOB = 0.08;

/** Map overlay uses this always — no user-facing smoothing control. */
export function gpsDefaultMapSmoothSettings(): GpsMapSmoothSettings {
  return gpsMapSmoothSettingsFromKnob(GPS_MAP_DEFAULT_LIGHT_KNOB);
}

/**
 * Knob-shaped parameterization in `[0,1]` (internal). Left = nearly raw; right = heavier smooth.
 */
export function gpsMapSmoothSettingsFromKnob(position01: number): GpsMapSmoothSettings {
  const x = Math.max(0, Math.min(1, position01));
  if (x <= 1e-4) {
    return {
      spatialSmooth: false,
      ewmaLambda: 1,
      hannPasses: 0,
      hannHalfWinCap: 0,
      minRunFloor: 5,
      crsChordSteps: 1,
    };
  }

  const spatialSmooth = true;
  /** λ floor was too high (~0.025) — at 100% knob EWMA barely changed stair-step quantization. */
  const rawExpEW = 0.98 * Math.exp(-8 * Math.pow(x, 1.12));
  const ewmaLambda = Math.min(0.55, Math.max(0.0036, rawExpEW));

  const hannPassesFinal = x >= 0.86 ? 2 : x >= 0.32 ? 1 : 0;
  const hannHalfWinCap = hannPassesFinal > 0 ? Math.max(2, Math.round(3 + x * 9)) : 0;

  const minRunFloor = Math.max(4, Math.min(11, Math.round(5 + x * 5)));

  /** Dense Catmull–Rom at high knob ⇒ visually smooth arcs between smoothed knots. */
  const crsChordSteps = Math.min(96, Math.round(2 + Math.pow(x, 0.85) * 78));

  return {
    spatialSmooth,
    ewmaLambda,
    hannPasses: hannPassesFinal,
    hannHalfWinCap,
    minRunFloor,
    crsChordSteps,
  };
}

interface V2 {
  x: number;
  y: number;
}

function hannWeight(d: number, half: number): number {
  const ad = Math.abs(d);
  if (ad > half) return 0;
  return 0.5 * (1 + Math.cos((Math.PI * d) / half));
}

/** Mean lat/lon of valid fixes — shared projection for spline densification + smoothing runs. */
export function gpsDisplayProjection(lat: Float32Array, lon: Float32Array): {
  centerLat: number;
  centerLon: number;
  mPerDegLon: number;
} | null {
  const n = lat.length;
  if (n === 0 || lon.length !== n) return null;
  let sLa = 0;
  let sLo = 0;
  let c = 0;
  for (let i = 0; i < n; i++) {
    if (!gpsCoordValid(lat[i]!, lon[i]!)) continue;
    sLa += lat[i]!;
    sLo += lon[i]!;
    c++;
  }
  if (c === 0) return null;
  const centerLat = sLa / c;
  const centerLon = sLo / c;
  return {
    centerLat,
    centerLon,
    mPerDegLon: M_PER_DEG_LAT * Math.cos((centerLat * Math.PI) / 180),
  };
}

function toXY(
  lat: number,
  lon: number,
  centerLat: number,
  centerLon: number,
  mPerDegLon: number,
): V2 {
  return {
    x: (lon - centerLon) * mPerDegLon,
    y: (lat - centerLat) * M_PER_DEG_LAT,
  };
}

function toLatLon(p: V2, centerLat: number, centerLon: number, mPerDegLon: number): [number, number] {
  return [
    p.y / M_PER_DEG_LAT + centerLat,
    p.x / mPerDegLon + centerLon,
  ];
}

/** Uniform Catmull–Rom between p1 and p2 (in meters). */
function catmullRom(p0: V2, p1: V2, p2: V2, p3: V2, t: number): V2 {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5
      * ((2 * p1.x)
        + (-p0.x + p2.x) * t
        + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2
        + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5
      * ((2 * p1.y)
        + (-p0.y + p2.y) * t
        + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2
        + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

function prevValidCoord(lat: Float32Array, lon: Float32Array, start: number): number {
  for (let k = start; k >= 0; k--) {
    if (gpsCoordValid(lat[k]!, lon[k]!)) return k;
  }
  return -1;
}

function nextValidCoord(lat: Float32Array, lon: Float32Array, start: number, n: number): number {
  for (let k = start; k < n; k++) {
    if (gpsCoordValid(lat[k]!, lon[k]!)) return k;
  }
  return -1;
}

/**
 * Curve along `[i1]`→`[i2]` (`i2` is usually `i1+1`) with Catmull–Rom tangents from neighbors.
 * When `steps <= 1`, returns the straight chord (only endpoints).
 */
export function denseLonLatChord(
  lat: Float32Array,
  lon: Float32Array,
  i1: number,
  i2: number,
  centerLat: number,
  centerLon: number,
  mPerDegLon: number,
  steps: number,
): [number, number][] {
  const A = lat[i1]!;
  const Ao = lon[i1]!;
  const B = lat[i2]!;
  const Bo = lon[i2]!;
  if (steps <= 1) {
    return [
      [A, Ao],
      [B, Bo],
    ];
  }

  const n = lat.length;
  const out: [number, number][] = [];
  let i0 = prevValidCoord(lat, lon, i1 - 1);
  let i3 = nextValidCoord(lat, lon, i2 + 1, n);

  const xy1 = toXY(A, Ao, centerLat, centerLon, mPerDegLon);
  const xy2 = toXY(B, Bo, centerLat, centerLon, mPerDegLon);

  let p0v: V2;
  let p3v: V2;
  if (i0 >= 0) {
    p0v = toXY(lat[i0]!, lon[i0]!, centerLat, centerLon, mPerDegLon);
  } else {
    p0v = { x: 2 * xy1.x - xy2.x, y: 2 * xy1.y - xy2.y };
  }
  if (i3 >= 0) {
    p3v = toXY(lat[i3]!, lon[i3]!, centerLat, centerLon, mPerDegLon);
  } else {
    p3v = { x: 2 * xy2.x - xy1.x, y: 2 * xy2.y - xy1.y };
  }

  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const p = catmullRom(p0v, xy1, xy2, p3v, t);
    out.push(toLatLon(p, centerLat, centerLon, mPerDegLon));
  }
  return out;
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
        sx += ((srcLon[idx]! - cLon) * mPerDegLon) * w;
        sy += ((srcLat[idx]! - cLat) * M_PER_DEG_LAT) * w;
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
export function smoothLonLatForMap(lat: Float32Array, lon: Float32Array, settings: GpsMapSmoothSettings): {
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
