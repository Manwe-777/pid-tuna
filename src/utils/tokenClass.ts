export function tokenClass(v: string, prev: string | undefined): string {
  if (prev === undefined || v.trim() === prev.trim()) return '';
  const vn = Number(v);
  const pn = Number(prev);
  if (!Number.isFinite(vn) || !Number.isFinite(pn)) return 'diff-tok--changed';
  if (vn > pn) return 'diff-tok--up';
  if (vn < pn) return 'diff-tok--down';
  return '';
}
