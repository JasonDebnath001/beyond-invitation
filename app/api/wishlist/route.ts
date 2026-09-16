import { NextResponse } from "next/server";
import { getSupabaseAuthServerClient } from "@/lib/supabase/auth-server";
import { MAX_WISHLIST_ITEMS, normalizeWishlistSlugs } from "@/lib/wishlist";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}

type Client = Awaited<ReturnType<typeof getSupabaseAuthServerClient>>;

async function readSlugs(client: Client, userId: string) {
  const { data, error } = await client
    .from("wishlist_items")
    .select("product_slug")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .order("product_slug", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => row.product_slug as string);
}

function validSlug(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 200;
}

async function handle(request: Request, method: "GET" | "POST" | "DELETE") {
  // Cookie-authenticated writes must originate on this site.
  const origin = request.headers.get("origin");
  if (method !== "GET" && origin && origin !== new URL(request.url).origin) {
    return json({ error: "This request is not allowed." }, 403);
  }
  if (method !== "GET" && request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return json({ error: "Send wishlist changes as JSON." }, 415);
  }

  try {
    const client = await getSupabaseAuthServerClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return json({ error: "Please sign in to access your saved wishlist." }, 401);

    // A request started before an account switch must never write to the new account.
    const expectedUser = request.headers.get("x-wishlist-user");
    if (expectedUser && expectedUser !== user.id) {
      return json({ error: "Your account changed. Please reload your wishlist." }, 409);
    }

    if (method === "GET") return json({ userId: user.id, slugs: await readSlugs(client, user.id) });

    const body = await request.json().catch(() => null);
    if (method === "DELETE") {
      if (!validSlug(body?.slug)) return json({ error: "Provide a valid product slug." }, 400);
      const { error: deleteError } = await client.from("wishlist_items").delete()
        .eq("user_id", user.id).eq("product_slug", body.slug.trim());
      if (deleteError) throw deleteError;
      return json({ userId: user.id, slugs: await readSlugs(client, user.id) });
    }

    const merging = Array.isArray(body?.slugs);
    const input = merging ? body.slugs : [body?.slug];
    if (input.length > MAX_WISHLIST_ITEMS || !input.every(validSlug)) {
      return json({ error: "Provide a valid list of up to 500 product slugs." }, 400);
    }
    const requested = normalizeWishlistSlugs(input);
    const current = await readSlugs(client, user.id);
    const newSlugs = requested.filter((slug) => !current.includes(slug));
    let available: string[] = [];
    if (newSlugs.length) {
      const { data: products, error: productError } = await client
        .from("v_web_products").select("slug").in("slug", newSlugs);
      if (productError) throw productError;
      const published = new Set((products ?? []).map((product) => product.slug));
      available = newSlugs.filter((slug) => published.has(slug));
      if (!merging && !available.length) return json({ error: "This product is no longer available." }, 404);
    }
    const capacity = Math.max(0, MAX_WISHLIST_ITEMS - current.length);
    if (!merging && available.length > capacity) return json({ error: "Your wishlist is full. Remove an item before adding another." }, 409);
    const toAdd = available.slice(0, capacity);
    if (toAdd.length) {
      const { error: insertError } = await client.from("wishlist_items").upsert(
        toAdd.map((slug) => ({ user_id: user.id, product_slug: slug })),
        { onConflict: "user_id,product_slug", ignoreDuplicates: true },
      );
      if (insertError) throw insertError;
    }
    return json({
      userId: user.id,
      slugs: await readSlugs(client, user.id),
      // Keep overflow on the device so signing in never silently loses these items.
      unmergedSlugs: available.slice(capacity),
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P0001") {
      return json({ error: "Your wishlist is full. Remove an item and try again." }, 409);
    }
    console.error("Wishlist request failed:", error);
    return json({ error: "Unable to sync your wishlist. Please try again." }, 503);
  }
}

export function GET(request: Request) { return handle(request, "GET"); }
export function POST(request: Request) { return handle(request, "POST"); }
export function DELETE(request: Request) { return handle(request, "DELETE"); }
