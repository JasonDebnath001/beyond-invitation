/** Keep catalogue names unchanged while showing their code in the storefront. */
export function formatProductName(name: string, itemCode?: string | null): string {
  const title = name.trim();
  const code = itemCode?.trim();
  if (!code || title.endsWith(`(${code})`)) return title;
  return title ? `${title} (${code})` : `(${code})`;
}
