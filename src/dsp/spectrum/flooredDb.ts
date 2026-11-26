/**
 * `factor · log10(x)` (10 for power, 20 for magnitude), clamped to `floorDb`;
 * non-positive values read as the floor.
 */
export function flooredDb(x: number, factor: number, floorDb: number): number {
  const db = x > 0 ? factor * Math.log10(x) : floorDb;

  return db < floorDb ? floorDb : db;
}
