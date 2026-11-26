import { BB_PREDICTOR } from '../constants';

/** What predictors can draw on besides the raw value. */
export interface PredictionContext {
  current: number[];
  previous: number[] | null;
  previous2: number[] | null;
  minThrottle: number;
  minMotor: number;
  vbatRef: number;
  /** Index of motor[0] in the main frame, or -1. */
  motor0: number;
  /** GPS home latitude and longitude, when a home frame was seen. */
  home: readonly [number, number] | null;
  /** Time of the last main frame (µs), or null before the first. */
  lastMainTime: number | null;
}

type Predict = (i: number, ctx: PredictionContext) => number;

/** What each predictor expects a field to be; the stored value is the difference. Without history, history predictors expect 0. */
const PREDICTORS: Record<number, Predict> = {
  [BB_PREDICTOR.zero]: () => 0,
  [BB_PREDICTOR.previous]: (i, c) => c.previous?.[i] ?? 0,
  [BB_PREDICTOR.straightLine]: (i, c) => (c.previous ? (2 * c.previous[i]! - (c.previous2 ?? c.previous)[i]!) | 0 : 0),
  [BB_PREDICTOR.average2]: (i, c) =>
    c.previous ? Math.trunc((c.previous[i]! + (c.previous2 ?? c.previous)[i]!) / 2) : 0,
  [BB_PREDICTOR.minThrottle]: (_, c) => c.minThrottle,
  [BB_PREDICTOR.minMotor]: (_, c) => c.minMotor,
  [BB_PREDICTOR.fifteenHundred]: () => 1500,
  [BB_PREDICTOR.vbatRef]: (_, c) => c.vbatRef,
  [BB_PREDICTOR.motor0]: (_, c) => (c.motor0 >= 0 ? c.current[c.motor0]! : 0),
  [BB_PREDICTOR.homeCoord]: (_, c) => c.home?.[0] ?? 0,
  [BB_PREDICTOR.homeCoord1]: (_, c) => c.home?.[1] ?? 0,
  [BB_PREDICTOR.lastMainFrameTime]: (_, c) => c.lastMainTime ?? 0,
};

/** The field's value: the stored difference plus what its predictor predicts, as a 32-bit integer. */
export function applyPrediction(predictor: number, i: number, value: number, ctx: PredictionContext): number {
  const predict = PREDICTORS[predictor];
  if (!predict) throw new Error(`Unsupported blackbox field predictor ${predictor}`);

  return (value + predict(i, ctx)) | 0;
}
