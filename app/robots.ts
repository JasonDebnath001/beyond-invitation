import type { MetadataRoute } from 'next'
import { getSiteUrl } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        disallow: ['/api/', '/account', '/checkout', '/cart', '/search', '/erp-debug'],
        allow: ['/', '/collections', '/products'],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
  }
}
