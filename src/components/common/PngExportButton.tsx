import { canvasPng } from '../../plot/canvasPng';
import { plotHeading } from '../../utils/plotHeading';
import { safeFileName } from '../../utils/safeFileName';
import { saveBlob } from '../../utils/saveBlob';

interface Props {
  /** Canvases to export, bottom first. */
  canvases: () => HTMLCanvasElement[];
  /** Element whose background colour fills behind the plot. */
  backgroundOf: () => HTMLElement | null;
  /** Explicit name; otherwise the plot's headings, then `fallbackName`. */
  name?: string;
  fallbackName: string;
}

/** Small "PNG" button in a plot's top-right corner, shown on hover. */
export function PngExportButton({ canvases, backgroundOf, name, fallbackName }: Props) {
  const exportPng = async () => {
    const el = backgroundOf();
    const background = el ? getComputedStyle(el).backgroundColor : '#0f141b';
    const blob = await canvasPng(canvases(), background);
    if (!blob) return;

    const label = name ?? plotHeading(el) ?? fallbackName;
    await saveBlob(`pidtuna-${safeFileName(label, 'plot')}.png`, blob, { name: 'PNG image', extension: 'png' });
  };

  return (
    <button
      type="button"
      className="absolute top-1 right-1 z-10 px-1.5 py-0.5 text-[0.7rem] opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
      title="Save this plot as a PNG image"
      onClick={exportPng}
    >
      PNG
    </button>
  );
}
