import type { MetadataRoute } from "next";

import { getAllCategories, getAllProducts } from "@/lib/products";
import { fetchErpProducts } from "@/lib/erpnext";
import type { Product } from "@/types";

const DEFAULT_SITE_URL = "https://www.beyondinvitation.co.in";

function getSiteUrl() {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  return (fromEnv || DEFAULT_SITE_URL).replace(/\/$/, "");
}

function uniqueByUrl(items: MetadataRoute.Sitemap) {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/collections",
    "/search",
    "/about",
    "/contact",
  ].map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : 0.7,
  }));

  const categories = await getAllCategories();

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${siteUrl}/collections/${category.slug}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.85,
  }));

  const localProducts = await getAllProducts();

  let erpProducts: Product[] = [];

  try {
    erpProducts = await fetchErpProducts();
  } catch {
    erpProducts = [];
  }

  const products = [...localProducts, ...erpProducts];

  const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${siteUrl}/products/${product.slug}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.9,
  }));

  return uniqueByUrl([...staticRoutes, ...categoryRoutes, ...productRoutes]);
}