/** True inside Tauri's webview, where file dialogs go through the dialog and fs plugins. */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
