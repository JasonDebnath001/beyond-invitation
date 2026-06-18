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
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/wedding-cards`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.98,
    },
    {
      url: `${siteUrl}/collections`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.75,
    },
    {
      url: `${siteUrl}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.55,
    },
    {
      url: `${siteUrl}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.55,
    },
    {
      url: `${siteUrl}/visit-us`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.55,
    },
    {
      url: `${siteUrl}/shipping-policy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.25,
    },
    {
      url: `${siteUrl}/refund-policy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.25,
    },
    {
      url: `${siteUrl}/privacy-policy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${siteUrl}/terms-and-conditions`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];

  const categories = await getAllCategories();

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${siteUrl}/collections/${category.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: category.slug.includes("wedding") ? 0.9 : 0.72,
  }));

  const localProducts = await getAllProducts();

  let erpProducts: Product[] = [];

  try {
    erpProducts = (await fetchErpProducts()) as Product[];
  } catch {
    erpProducts = [];
  }

  const products = [...localProducts, ...erpProducts];

  const productRoutes: MetadataRoute.Sitemap = products.map((product) => {
    const lastModified =
      (product as any).modifiedAt || (product as any).updatedAt || now;

    const text = [
      product.name,
      product.slug,
      product.category,
      product.description,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const isWeddingProduct =
      text.includes("wedding") ||
      text.includes("marriage") ||
      text.includes("bride") ||
      text.includes("groom") ||
      text.includes("invitation");

    return {
      url: `${siteUrl}/products/${product.slug}`,
      lastModified: new Date(lastModified),
      changeFrequency: "weekly",
      priority: isWeddingProduct ? 0.92 : 0.82,
    };
  });

  return uniqueByUrl([...staticRoutes, ...categoryRoutes, ...productRoutes]);
}