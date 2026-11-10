import { buildErpProductList, type ErpProduct } from "@/lib/catalog";
import {
  getProductQuantityRules,
  isValidProductQuantity,
} from "@/lib/product-quantity";
import { applyMarginToPrice, type Reseller } from "@/lib/reseller";
import type { ShippingQuote } from "@/lib/shipping";

export class CheckoutValidationError extends Error {}

export interface CheckoutLineInput {
  itemCode?: string;
  slug?: string;
  quantity: number;
}

export interface ResolvedLine {
  itemCode: string;
  printName: string;
  name: string;
  /** Authoritative base unit price from the public catalogue (INR). */
  basePrice: number;
  /** Unit price actually charged (base + reseller margin, if any). */
  price: number;
  quantity: number;
  /** Per-unit grams from the catalogue, never from the request. */
  weightGrams?: number;
}

export interface ResolvedCart {
  lines: ResolvedLine[];
  amountPaise: number;
  currency: "INR";
  /** Total reseller commission in INR (0 when no reseller). */
  commission: number;
  shipping?: ShippingQuote;
}

export function parseCheckoutItems(input: unknown): CheckoutLineInput[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > 100) {
    throw new CheckoutValidationError("Provide between 1 and 100 cart items.");
  }
  return input.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new CheckoutValidationError("Please check the items in your cart.");
    }
    const itemCode =
      typeof value.itemCode === "string" ? value.itemCode.trim() : "";
    const slug = typeof value.slug === "string" ? value.slug.trim() : "";
    if (
      (!itemCode && !slug) ||
      itemCode.length > 200 ||
      slug.length > 200 ||
      !Number.isSafeInteger(value.quantity) ||
      value.quantity <= 0 ||
      value.quantity > 10000
    ) {
      throw new CheckoutValidationError(
        "Please check the product and quantity in your cart.",
      );
    }
    return {
      itemCode: itemCode || undefined,
      slug: slug || undefined,
      quantity: value.quantity,
    };
  });
}

/**
 * Resolve client cart lines against the live product catalogue. The client
 * only supplies item code / slug + quantity; prices are looked up here so a
 * tampered client can never dictate the amount. One cached catalogue read.
 *
 * If a reseller is active (referral cookie), the same margin rule used for
 * display is applied here, so the charge always equals what was shown.
 */
export async function resolveCartProducts(
  items: CheckoutLineInput[],
  reseller?: Reseller | null,
): Promise<ResolvedCart> {
  const requestedItems = parseCheckoutItems(items);
  const catalogue = await buildErpProductList();

  const byCode = new Map<string, ErpProduct>();
  const bySlug = new Map<string, ErpProduct>();
  for (const p of catalogue) {
    byCode.set(p.itemCode, p);
    bySlug.set(p.slug, p);
  }

  const marginPercent =
    reseller && reseller.active ? reseller.marginPercent : 0;

  const lines: ResolvedLine[] = [];
  const seenProducts = new Set<string>();
  for (const it of requestedItems) {
    const product =
      (it.itemCode && byCode.get(it.itemCode)) ||
      (it.slug && bySlug.get(it.slug)) ||
      null;
    if (
      !product ||
      (it.itemCode && product.itemCode !== it.itemCode) ||
      (it.slug && product.slug !== it.slug)
    ) {
      throw new CheckoutValidationError(
        "An item in your cart is no longer available. Please remove it and try again.",
      );
    }
    if (seenProducts.has(product.itemCode)) {
      throw new CheckoutValidationError(
        "Your cart contains a duplicate product. Please refresh your cart.",
      );
    }
    seenProducts.add(product.itemCode);

    if (
      product.hasPrice === false ||
      !Number.isFinite(product.price) ||
      product.price <= 0
    ) {
      throw new CheckoutValidationError(
        `${product.name}: price on request. Please contact us for a quote before ordering.`,
      );
    }

    const qty = Number(it?.quantity);
    const quantityRules = getProductQuantityRules(product);

    if (qty > 10000 || !isValidProductQuantity(qty, product)) {
      throw new CheckoutValidationError(
        `${product.name} must be ordered in quantities of at least ${quantityRules.minimum}, increasing by ${quantityRules.step}.`,
      );
    }

    const basePrice = product.price;
    const price =
      marginPercent > 0
        ? applyMarginToPrice(basePrice, marginPercent)
        : basePrice;

    lines.push({
      itemCode: product.itemCode,
      printName: product.printName ?? "",
      name: product.name,
      basePrice,
      price,
      quantity: qty,
      weightGrams: product.dimensions?.weight,
    });
  }

  const totalInr = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const amountPaise = Math.round(totalInr * 100);

  const commission =
    Math.round(
      lines.reduce((s, l) => s + (l.price - l.basePrice) * l.quantity, 0) * 100,
    ) / 100;

  if (lines.length === 0 || amountPaise === 0) {
    throw new CheckoutValidationError("Cart is empty or has no valid items");
  }

  return { lines, amountPaise, currency: "INR", commission };
}
