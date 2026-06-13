import { getSiteUrl } from "@/lib/site-config";

export default function GET() {
  const site = getSiteUrl();
  const sitemapUrl = `${site}/sitemap.xml`;

  const lines = [
    "User-agent: *",
    "Disallow: /api/",
    "Disallow: /account",
    "Disallow: /checkout",
    "Disallow: /cart",
    "Disallow: /search",
    "Disallow: /erp-debug",
    "Allow: /",
    "Allow: /collections",
    "Allow: /products",
    "Sitemap: " + sitemapUrl,
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
