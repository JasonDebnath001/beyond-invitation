import { fetchErpProductPage } from "@/lib/catalog";
import { fetchItemCategoryProductPage } from "@/lib/catalog-item-category";
import { PRODUCTS_PER_PAGE } from "@/lib/product-page";
import { getSiteUrl } from "@/lib/site-config";
import { ProductSection } from "@/components/ProductGrid";
import { FeatureStrip, SaleCollection } from "@/components/Sections";
import JsonLd from "@/components/seo/JsonLd";

function getAbsoluteImageUrl(image: string | undefined, siteUrl: string) {
  if (!image) return undefined;
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  return image.startsWith("/") ? `${siteUrl}${image}` : `${siteUrl}/${image}`;
}

function ProductSectionSkeleton({
  label,
  title,
  shaded = false,
}: {
  label: string;
  title: string;
  shaded?: boolean;
}) {
  return (
    <section className="bg-white py-14 md:py-20">
      <div className="mx-auto max-w-[1800px] px-4 sm:px-6 lg:px-8">
        <div className="mb-8 md:mb-10">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-gold">
            {label}
          </p>
          <h2 className="font-serif text-3xl font-semibold text-ink md:text-4xl">
            {title}
          </h2>
        </div>
        <div aria-hidden="true" className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-8 motion-safe:animate-pulse sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: PRODUCTS_PER_PAGE }, (_, index) => (
            <div key={index} className="min-w-0">
              <div className="aspect-square bg-neutral-100" />
              <div className="space-y-2.5 pt-4">
                <div className="h-4 w-4/5 rounded bg-neutral-100" />
                <div className="h-5 w-1/2 rounded bg-neutral-100" />
              </div>
            </div>
          ))}
        </div>
        <div aria-hidden="true" className="mx-auto mt-8 h-12 w-40 rounded-full bg-stone-100 motion-safe:animate-pulse" />
      </div>
    </section>
  );
}

/** Reserve the same ten-card grids while the first catalogue page loads. */
export function HomeProductsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading products">
      <p role="status" className="sr-only">Loading products</p>
      <ProductSectionSkeleton label="Limited time offer" title="Sale Collection" shaded />
      <ProductSectionSkeleton label="Fresh from our catalogue" title="Trendy Collection" />
      <FeatureStrip />
      <ProductSectionSkeleton label="Exclusive & elegant" title="Premium Invitations" shaded />
    </div>
  );
}

/** Sale and Trendy share a priced page; Premium features wedding boxes. */
export default async function HomeProducts({ description }: { description: string }) {
  let weddingBoxesPage;
  let pricedPage;
  try {
    [weddingBoxesPage, pricedPage] = await Promise.all([
      fetchItemCategoryProductPage("Wedding Box"),
      fetchErpProductPage(0, true),
    ]);
  } catch (error) {
    console.error("Catalogue product fetch failed on homepage:", error);
    return (
      <>
        <section className="mx-auto max-w-[1800px] px-4 py-16 sm:px-6 lg:px-8">
          <div role="status" className="rounded-3xl border border-gold/20 bg-white p-6 text-ink">
            <h2 className="font-serif text-3xl">Products could not be loaded</h2>
            <p className="mt-3 text-sm text-ink-mid">Please refresh the page or try again shortly.</p>
          </div>
        </section>
        <FeatureStrip />
      </>
    );
  }

  const { products, nextOffset } = weddingBoxesPage;
  const featuredProducts = Array.from(
    new Map([...pricedPage.products, ...products].map((product) => [product.slug, product])).values(),
  );
  const siteUrl = getSiteUrl();
  const productListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Featured wedding cards and invitation stationery",
    itemListElement: featuredProducts.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${siteUrl}/products/${product.slug}`,
      item: {
        "@type": "Product",
        name: product.name,
        description: product.description || description,
        image: getAbsoluteImageUrl(product.images?.[0], siteUrl),
        url: `${siteUrl}/products/${product.slug}`,
        offers: product.price > 0
          ? {
              "@type": "Offer",
              priceCurrency: "INR",
              price: product.price,
              availability: "https://schema.org/InStock",
            }
          : undefined,
      },
    })),
  };

  return (
    <>
      {featuredProducts.length > 0 ? <JsonLd data={productListJsonLd} /> : null}
      <SaleCollection products={pricedPage.products} nextOffset={pricedPage.nextOffset} />
      <ProductSection
        label="Fresh from our catalogue"
        title="Trendy Collection"
        products={pricedPage.products}
        nextOffset={pricedPage.nextOffset}
        pricedOnly
        viewAllHref="/catalog"
        viewAllText="View All Products"
      />
      <FeatureStrip />
      <ProductSection
        label="Exclusive & elegant"
        title="Premium Invitations"
        products={products}
        nextOffset={nextOffset}
        collection="wedding-boxes"
        viewAllHref="/wedding-boxes"
        viewAllText="View All Wedding Boxes"
        shaded
      />
    </>
  );
}
