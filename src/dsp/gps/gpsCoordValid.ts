export function gpsCoordValid(la: number, lo: number): boolean {
  return Number.isFinite(la) && Number.isFinite(lo) && !(la === 0 && lo === 0);
}
