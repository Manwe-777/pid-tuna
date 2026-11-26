import { BB_ENCODING, BB_PREDICTOR } from '../constants';
import type { BbFrameDef } from '../types';
import { applyPrediction, type PredictionContext } from './applyPrediction';
import type { ByteReader } from './ByteReader';
import { readTag2_3S32 } from './readTag2_3S32';
import { readTag2_3SVariable } from './readTag2_3SVariable';
import { readTag8_4S16 } from './readTag8_4S16';
import { readTag8_8SVB } from './readTag8_8SVB';
import { signExtend } from './signExtend';

const group = new Array<number>(8).fill(0);

/** How many fields a group encoding covers starting at field `i`. */
function groupSize(def: BbFrameDef, i: number): number {
  const enc = def.encodings[i];
  if (enc === BB_ENCODING.tag8_4S16) return 4;
  if (enc === BB_ENCODING.tag2_3S32 || enc === BB_ENCODING.tag2_3SVariable) return 3;
  if (enc !== BB_ENCODING.tag8_8SVB) return 1;
  let j = i + 1;
  while (j < i + 8 && j < def.names.length && def.encodings[j] === BB_ENCODING.tag8_8SVB) j++;

  return j - i;
}

/** Reads the raw (unpredicted) values of the fields from `i`, into `group`; returns how many. */
function readRaw(r: ByteReader, def: BbFrameDef, i: number, dataVersion: number): number {
  const count = groupSize(def, i);

  switch (def.encodings[i]) {
    case BB_ENCODING.signedVB:
      group[0] = r.signedVB();
      break;
    case BB_ENCODING.unsignedVB:
      group[0] = r.unsignedVB() | 0;
      break;
    case BB_ENCODING.neg14Bit:
      group[0] = -signExtend(r.unsignedVB(), 14);
      break;
    case BB_ENCODING.tag8_4S16:
      readTag8_4S16(r, group, dataVersion);
      break;
    case BB_ENCODING.tag2_3S32:
      readTag2_3S32(r, group);
      break;
    case BB_ENCODING.tag2_3SVariable:
      readTag2_3SVariable(r, group);
      break;
    case BB_ENCODING.tag8_8SVB:
      readTag8_8SVB(r, group, count);
      break;
    case BB_ENCODING.none:
      group[0] = 0;
      break;
    default:
      throw new Error(`Unsupported blackbox field encoding ${def.encodings[i]} for ${def.names[i]}`);
  }

  return count;
}

/**
 * Decodes one frame's fields into `ctx.current`. Increment fields aren't stored: they count
 * `skipped + 1` on from the previous frame.
 */
export function decodeFields(
  r: ByteReader,
  def: BbFrameDef,
  ctx: PredictionContext,
  skipped: number,
  dataVersion: number,
): void {
  const { current } = ctx;
  const n = def.names.length;

  for (let i = 0; i < n;) {
    if (def.predictors[i] === BB_PREDICTOR.increment) {
      current[i] = (skipped + 1 + (ctx.previous?.[i] ?? 0)) | 0;
      i++;
      continue;
    }

    const count = readRaw(r, def, i, dataVersion);
    for (let j = 0; j < count && i < n; j++, i++) current[i] = applyPrediction(def.predictors[i]!, i, group[j]!, ctx);
  }
}
