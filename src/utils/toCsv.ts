type Cell = string | number | null | undefined;

function cell(v: Cell): string {
  if (v == null || (typeof v === 'number' && !Number.isFinite(v))) return '';
  const s = String(v);

  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV text (RFC 4180): fields with commas, quotes or line breaks are quoted; missing numbers are empty. */
export function toCsv(header: string[], rows: Cell[][]): string {
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
