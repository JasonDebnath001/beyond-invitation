import type { MetadataRoute } from "next";

import { getAllCategories, getAllProducts } from "@/lib/products";
import { fetchErpProducts } from "@/lib/erpnext";
import type { Product } from "@/types";
import { getSiteUrl } from "@/lib/site-config";

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

  const staticRoutes: MetadataRoute.Sitemap = ["", "/collections", "/about", "/contact"].map((route) => ({
    url: `${siteUrl}${route}`,
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : 0.6,
  }));

  const categories = await getAllCategories();

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${siteUrl}/collections/${category.slug}`,
    changeFrequency: "weekly",
    priority: 0.75,
  }));

  const localProducts = await getAllProducts();

  let erpProducts: Product[] = [];

  try {
    erpProducts = await fetchErpProducts();
  } catch {
    erpProducts = [];
  }

  const products = [...localProducts, ...erpProducts];

  const productRoutes: MetadataRoute.Sitemap = products.map((product) => {
    const lastModified = (product as any).modifiedAt || (product as any).updatedAt || undefined;

    return {
      url: `${siteUrl}/products/${product.slug}`,
      lastModified: lastModified ? new Date(lastModified) : undefined,
      changeFrequency: "weekly",
      priority: 0.9,
    } as MetadataRoute.SitemapItem;
  });

  return uniqueByUrl([...staticRoutes, ...categoryRoutes, ...productRoutes]);
}