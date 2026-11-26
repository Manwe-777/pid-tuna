/** Sizes a canvas's backing store for the device pixel ratio and its CSS box to width × height. */
export function sizeCanvas(c: HTMLCanvasElement, width: number, height: number, dpr: number) {
  c.width = Math.max(1, width * dpr);
  c.height = Math.max(1, height * dpr);
  c.style.width = `${width}px`;
  c.style.height = `${height}px`;
}
