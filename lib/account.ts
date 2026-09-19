import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getCatalogProducts } from "@/lib/catalog";

type AccountUser = Pick<User, "email" | "user_metadata" | "identities">;

export type AccountOrder = {
  id: string;
  reference: string;
  date: string;
  amount: string;
  status: "paid" | "pending";
  itemCount: number;
  items: { name: string; itemCode: string; quantity: number; unitPrice: string; total: string }[];
  paymentReference: string;
};

export type SavedProduct = {
  slug: string;
  name: string;
  itemCode?: string;
  images: string[];
  price: number;
  mrp: number;
};

export function displayName(user: AccountUser): string {
  for (const value of [user.user_metadata.full_name, user.user_metadata.name]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return user.email?.split("@")[0] || "Guest";
}

export function initials(user: AccountUser): string {
  const name = [user.user_metadata.full_name, user.user_metadata.name]
    .find((value) => typeof value === "string" && value.trim());
  if (!name) return (user.email?.[0] || "G").toUpperCase();
  const words = (name as string).trim().split(/\s+/);
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
}

export function formatInr(paise: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
}

export function formatOrderDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

export function orderReference(id: string): string {
  return `Order #${id.slice(0, 8).toUpperCase()}`;
}

export function hasEmailIdentity(user: AccountUser): boolean {
  return user.identities?.some(({ provider }) => provider === "email") ?? false;
}

export async function fetchRecentWebsiteOrders(client: SupabaseClient, userId: string): Promise<AccountOrder[]> {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await client.from("website_orders")
      .select("id,created_at,payment_status,amount_paise,items,razorpay_payment_id")
      .eq("user_id", userId)
      .or(`payment_status.eq.paid,and(payment_status.eq.pending,created_at.gte.${cutoff})`)
      .order("created_at", { ascending: false }).limit(10);
    if (error) throw error;
    return (data ?? [])
      .filter((row) => row.payment_status === "paid" ||
        (row.payment_status === "pending" && Date.parse(row.created_at) >= Date.parse(cutoff)))
      .map((row) => {
        // Only presentation fields cross the server/client boundary, including inside JSON items.
        const items = (Array.isArray(row.items) ? row.items : []).map((line) => ({
          name: String(line.name), itemCode: String(line.itemCode), quantity: Number(line.quantity),
          unitPrice: formatInr(Math.round(Number(line.price) * 100)),
          total: formatInr(Math.round(Number(line.price) * Number(line.quantity) * 100)),
        }));
        return {
          id: row.id, reference: orderReference(row.id), date: formatOrderDate(row.created_at),
          amount: formatInr(row.amount_paise), status: row.payment_status,
          itemCount: items.reduce((sum, item) => sum + item.quantity, 0), items,
          paymentReference: row.payment_status === "paid" ? row.razorpay_payment_id || "" : "",
        };
      });
  } catch (error) {
    console.error("Account orders unavailable:", error);
    return [];
  }
}

export async function fetchSavedProducts(client: SupabaseClient, userId: string): Promise<SavedProduct[]> {
  try {
    const { data, error } = await client.from("wishlist_items").select("product_slug,created_at")
      .eq("user_id", userId).order("created_at", { ascending: false });
    if (error) throw error;
    if (!data?.length) return [];
    const catalog = new Map((await getCatalogProducts()).map((product) => [product.slug, product]));
    return data.flatMap(({ product_slug }) => {
      const product = catalog.get(product_slug);
      return product ? [{ slug: product.slug, name: product.name, itemCode: product.itemCode, images: product.images.slice(0, 1),
        price: product.price, mrp: product.mrp ?? 0 }] : [];
    }).slice(0, 6);
  } catch (error) {
    console.error("Account saved designs unavailable:", error);
    return [];
  }
}

// Count all owned records, independently of the ten-order and six-design previews.
export async function fetchAccountCounts(client: SupabaseClient, userId: string) {
  async function count(table: "website_orders" | "wishlist_items") {
    try {
      let query = client.from(table).select("user_id", { count: "exact", head: true }).eq("user_id", userId);
      if (table === "website_orders") query = query.eq("payment_status", "paid");
      const { count, error } = await query;
      if (error) throw error;
      return count ?? 0;
    } catch (error) {
      console.error(`Account ${table} count unavailable:`, error);
      return 0;
    }
  }
  const [paidOrders, savedDesigns] = await Promise.all([count("website_orders"), count("wishlist_items")]);
  return { paidOrders, savedDesigns };
}
