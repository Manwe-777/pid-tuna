import { useCallback, useRef, useState } from 'react';

export interface FilePickerProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

/**
 * Tauri 2 exposes this object on `window` inside webviews; absent in regular browsers.
 * The HTML `<input type="file">` dialog doesn't reliably trigger from inside Tauri's
 * WKWebView (macOS) / WebKitGTK (Linux), so when running in Tauri we route through
 * the dialog + fs plugins instead.
 */
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function pickFileViaTauri(): Promise<File | null> {
  const [{ open }, { readFile }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/plugin-fs'),
  ]);
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [
      { name: 'Blackbox log', extensions: ['bbl', 'bfl', 'BBL', 'BFL', 'csv'] },
    ],
  });
  if (!selected || typeof selected !== 'string') return null;
  const bytes = await readFile(selected);
  const name = selected.split(/[\\/]/).pop() ?? 'log.bbl';
  return new File([bytes], name, { type: 'application/octet-stream' });
}

export function FilePicker({ onFile, disabled }: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handle = useCallback(
    (file: File | null | undefined) => {
      if (!file || disabled) return;
      onFile(file);
    },
    [onFile, disabled],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      handle(e.dataTransfer.files?.[0]);
    },
    [handle],
  );

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setDragging(false), []);

  const onClick = useCallback(() => {
    if (disabled) return;
    if (isTauri()) {
      pickFileViaTauri()
        .then((f) => handle(f))
        .catch((err) => console.error('Tauri file picker failed:', err));
      return;
    }
    inputRef.current?.click();
  }, [disabled, handle]);

  return (
    <div
      className={`dropzone${dragging ? ' dropzone--active' : ''}${disabled ? ' dropzone--disabled' : ''}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".bbl,.bfl,.BBL,.BFL,.csv"
        style={{ display: 'none' }}
        onChange={(e) => handle(e.target.files?.[0])}
      />
      <div className="dropzone__label">
        {disabled ? 'Parsing…' : 'Drop a .bbl / .bfl / .csv log here, or click to choose'}
      </div>
    </div>
  );
}
