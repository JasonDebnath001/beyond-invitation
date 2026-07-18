import { buildErpProductList, type ErpProduct } from "@/lib/erpnext";
import { applyMarginToPrice, type Reseller } from "@/lib/reseller";

export interface CheckoutLineInput {
  itemCode?: string;
  slug?: string;
  quantity: number;
}

export interface ResolvedLine {
  itemCode: string;
  name: string;
  /** Authoritative base unit price from ERPNext (INR). */
  basePrice: number;
  /** Unit price actually charged (base + reseller margin, if any). */
  price: number;
  quantity: number;
}

export interface ResolvedCart {
  lines: ResolvedLine[];
  amountPaise: number;
  currency: "INR";
  /** Total reseller commission in INR (0 when no reseller). */
  commission: number;
}

/**
 * Resolve client cart lines against the live ERPNext catalogue. The client
 * only supplies item code / slug + quantity; prices are looked up here so a
 * tampered client can never dictate the amount. One ERP list call.
 *
 * If a reseller is active (referral cookie), the same margin rule used for
 * display is applied here, so the charge always equals what was shown.
 */
export async function resolveCartProducts(
  items: CheckoutLineInput[],
  reseller?: Reseller | null,
): Promise<ResolvedCart> {
  const catalogue = await buildErpProductList(); // throws if ERP is unreachable

  const byCode = new Map<string, ErpProduct>();
  const bySlug = new Map<string, ErpProduct>();
  for (const p of catalogue) {
    byCode.set(p.itemCode, p);
    bySlug.set(p.slug, p);
  }

  const marginPercent =
    reseller && reseller.active ? reseller.marginPercent : 0;

  const lines: ResolvedLine[] = [];
  for (const it of Array.isArray(items) ? items : []) {
    const qty = Math.min(Math.floor(Number(it?.quantity) || 0), 10000);
    if (qty < 1) continue;

    const product =
      (it.itemCode && byCode.get(it.itemCode)) ||
      (it.slug && bySlug.get(it.slug)) ||
      null;
    if (!product) continue;

    const basePrice = product.price;
    const price =
      marginPercent > 0
        ? applyMarginToPrice(basePrice, marginPercent)
        : basePrice;

    lines.push({
      itemCode: product.itemCode,
      name: product.name,
      basePrice,
      price,
      quantity: qty,
    });
  }

  const totalInr = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const amountPaise = Math.round(totalInr * 100);

  const commission =
    Math.round(
      lines.reduce(
        (s, l) => s + (l.price - l.basePrice) * l.quantity,
        0,
      ) * 100,
    ) / 100;

  if (lines.length === 0 || amountPaise === 0) {
    throw new Error("Cart is empty or has no valid items");
  }

  return { lines, amountPaise, currency: "INR", commission };
}