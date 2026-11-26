/** Text of the heading that labels a plot: its own axis-plot title, else its section's heading. */
export function plotHeading(el: HTMLElement | null): string | null {
  const own = el?.closest('.axis-plot')?.querySelector('h3, h4, h5')?.textContent;
  const section = el?.closest('section')?.querySelector('h2')?.textContent;
  const parts = [section, own].map((t) => t?.trim()).filter((t): t is string => Boolean(t));

  return parts.length > 0 ? parts.join(' ') : null;
}
