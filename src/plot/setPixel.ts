/** Writes an opaque RGB pixel at byte offset `idx` of ImageData pixels. */
export function setPixel(px: Uint8ClampedArray, idx: number, [r, g, b]: readonly [number, number, number]) {
  px[idx] = r;
  px[idx + 1] = g;
  px[idx + 2] = b;
  px[idx + 3] = 255;
}
