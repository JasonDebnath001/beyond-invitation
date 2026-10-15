/** Keep catalogue titles unchanged while showing their Print Name in brackets. */
export function formatProductName(name: string, printName?: string | null): string {
  const title = name.trim();
  const suffix = printName?.trim();
  if (!suffix || title === suffix || title.endsWith(`(${suffix})`)) return title;
  return title ? `${title} (${suffix})` : `(${suffix})`;
}
