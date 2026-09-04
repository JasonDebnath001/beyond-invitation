export const MIN_ORDER_QUANTITY = 50;
export const WEDDING_BOX_MIN_ORDER_QUANTITY = 25;

export type QuantityStep = 25 | 50;
export type MinimumQuantity = 25 | 50;

type QuantityAwareProduct = {
  name?: string;
  slug?: string;
  itemGroup?: string;
  subject?: string;
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
  return getProductQuantityRules(product).step;
}

export function getProductQuantityRules(
  product: QuantityAwareProduct,
): {
  minimum: MinimumQuantity;
  step: QuantityStep;
} {
  const subject = normalize(product.subject);

  if (subject.startsWith("wedding box")) {
    return {
      minimum: WEDDING_BOX_MIN_ORDER_QUANTITY,
      step: 25,
    };
  }

  const isShagunEnvelopeSubject =
    (subject.includes("shagun") || subject.includes("sagun")) &&
    subject.includes("envelope");

  if (isShagunEnvelopeSubject) {
    return {
      minimum: MIN_ORDER_QUANTITY,
      step: 50,
    };
  }

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
    return {
      minimum: MIN_ORDER_QUANTITY,
      step: 50,
    };
  }

  /*
   * Fallback when itemGroup is unavailable, such as old cart data.
   */
  const productText = normalize(
    `${product.name ?? ""} ${product.slug ?? ""}`,
  );

  const isShagun =
    productText.includes("shagun") ||
    productText.includes("sagun");

  const isEnvelope = productText.includes("envelope");

  return {
    minimum: MIN_ORDER_QUANTITY,
    step: isShagun && isEnvelope ? 50 : 25,
  };
}

export function normalizeProductQuantity(
  quantity: number,
  product: QuantityAwareProduct,
): number {
  const { minimum, step } = getProductQuantityRules(product);

  if (!Number.isFinite(quantity)) {
    return minimum;
  }

  const wholeQuantity = Math.max(minimum, Math.floor(quantity));

  return minimum + Math.floor((wholeQuantity - minimum) / step) * step;
}

export function isValidProductQuantity(
  quantity: number,
  product: QuantityAwareProduct,
): boolean {
  if (!Number.isInteger(quantity)) return false;

  const { minimum, step } = getProductQuantityRules(product);

  return quantity >= minimum && (quantity - minimum) % step === 0;
}
