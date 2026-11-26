import { isTauri } from './isTauri';

/**
 * Saves a file: a save dialog in the desktop app, a normal download in the
 * browser. Resolves false when the user cancels the dialog.
 */
export async function saveBlob(fileName: string, blob: Blob, filter: { name: string; extension: string }) {
  if (isTauri()) {
    const [{ save }, { writeFile }] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-fs'),
    ]);
    const path = await save({
      defaultPath: fileName,
      filters: [{ name: filter.name, extensions: [filter.extension] }],
    });
    if (!path) return false;
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()));

    return true;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);

  return true;
}
