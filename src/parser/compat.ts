/**
 * Workaround for a bug in the deprecated `blackbox-log` library (v0.2.2).
 *
 * The library caches a `DataView` over the WASM module's `memory.buffer` and
 * checks `view.byteLength` to detect when the buffer has been detached
 * (which happens whenever WASM linear memory grows — necessary for larger
 * logs). Historically `DataView.prototype.byteLength` returned 0 on a detached
 * buffer; modern V8/JSC throw a TypeError instead. The library's detachment
 * check therefore throws before it can rebuild the view.
 *
 * Restoring the historical 0-on-detached behavior makes the library's cache
 * invalidation work as intended. We patch once at module load, before any
 * library code runs.
 */
function makeNonThrowing<T extends object>(proto: T, key: keyof T): void {
  const desc = Object.getOwnPropertyDescriptor(proto, key);
  const origGet = desc?.get;
  if (!origGet) return;
  Object.defineProperty(proto, key, {
    configurable: true,
    enumerable: false,
    get: function () {
      try {
        return origGet.call(this);
      } catch {
        return 0;
      }
    },
  });
}

makeNonThrowing(DataView.prototype, 'byteLength');
makeNonThrowing(DataView.prototype, 'byteOffset');
