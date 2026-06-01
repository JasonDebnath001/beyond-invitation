import { buildErpProductList, type ErpProduct } from "@/lib/erpnext";

export interface CheckoutLineInput {
  itemCode?: string;
  slug?: string;
  quantity: number;
}

export interface ResolvedLine {
  itemCode: string;
  name: string;
  price: number; // authoritative unit price (INR)
  quantity: number;
}

export interface ResolvedCart {
  lines: ResolvedLine[];
  amountPaise: number;
  currency: "INR";
}

/**
 * Resolve client cart lines against the live ERPNext catalogue. The client
 * only supplies item code / slug + quantity; prices are looked up here so a
 * tampered client can never dictate the amount. One ERP list call.
 */
export async function resolveCartProducts(
  items: CheckoutLineInput[],
): Promise<ResolvedCart> {
  const catalogue = await buildErpProductList(); // throws if ERP is unreachable

  const byCode = new Map<string, ErpProduct>();
  const bySlug = new Map<string, ErpProduct>();
  for (const p of catalogue) {
    byCode.set(p.itemCode, p);
    bySlug.set(p.slug, p);
  }

  const lines: ResolvedLine[] = [];
  for (const it of Array.isArray(items) ? items : []) {
    const qty = Math.min(Math.floor(Number(it?.quantity) || 0), 10000);
    if (qty < 1) continue;

    const product =
      (it.itemCode && byCode.get(it.itemCode)) ||
      (it.slug && bySlug.get(it.slug)) ||
      null;
    if (!product) continue;

    lines.push({
      itemCode: product.itemCode,
      name: product.name,
      price: product.price,
      quantity: qty,
    });
  }

  const totalInr = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  return { lines, amountPaise: Math.round(totalInr * 100), currency: "INR" };
}