export const MIN_ORDER_QUANTITY = 50;

export type QuantityStep = 25 | 50;

type QuantityAwareProduct = {
  name: string;
  slug: string;
  itemGroup?: string;
};

function normalize(value?: string): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function getProductQuantityStep(
  product: QuantityAwareProduct,
): QuantityStep {
  const itemGroup = normalize(product.itemGroup);

  /*
   * ERPNext may use either:
   * - Shagun Envelopes
   * - Sagun Envelopes
   */
  if (
    itemGroup.includes("shagun") ||
    itemGroup.includes("sagun")
  ) {
    return 50;
  }

  /*
   * Fallback when itemGroup is unavailable, such as old cart data.
   */
  const productText = normalize(
    `${product.name} ${product.slug}`,
  );

  const isShagun =
    productText.includes("shagun") ||
    productText.includes("sagun");

  const isEnvelope = productText.includes("envelope");

  return isShagun && isEnvelope ? 50 : 25;
}