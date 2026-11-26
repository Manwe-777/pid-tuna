/**
 * Returns true when the code is running inside Tauri's webview. Same check
 * we already use in `FilePicker.tsx`.
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
