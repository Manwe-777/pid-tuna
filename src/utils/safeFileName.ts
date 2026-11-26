/** A file name from free text: lower case, words joined by dashes, nothing a file system rejects. */
export function safeFileName(text: string, fallback: string): string {
  const slug = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return slug || fallback;
}
