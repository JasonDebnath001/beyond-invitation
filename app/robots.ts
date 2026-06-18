import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/wedding-cards",
          "/collections/",
          "/products/",
          "/about",
          "/contact",
          "/visit-us",
        ],
        disallow: [
          "/api/",
          "/account",
          "/checkout",
          "/cart",
          "/wishlist",
          "/my-orders",
          "/search",
          "/erp-debug",
        ],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
  };
}