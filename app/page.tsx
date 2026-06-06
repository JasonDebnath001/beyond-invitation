import { getAllCategories } from "@/lib/products";
import { fetchErpProducts, type ErpProduct } from "@/lib/erpnext";

import {
  CelebrationGrid,
  SaleCollection,
  FeatureStrip,
  WhyUs,
  Testimonials,
} from "@/components/Sections";

import HeroCarousel from "@/components/HeroCarousel";
import { ProductSection } from "@/components/ProductGrid";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getNormalProducts(products: ErpProduct[]): ErpProduct[] {
  return products.map((product) => {
    const originalPrice = Number(product.price || 0);

    return {
      ...product,

      // Normal product sections should NOT show the sale strikethrough.
      mrp: originalPrice,

      // Remove sale-only display from normal sections.
      badge: product.badge === "SALE" ? undefined : product.badge,
      onSale: false,
    };
  });
}

export default async function HomePage() {
  const categories = await getAllCategories();

  let erpProducts: ErpProduct[] = [];
  let erpError = "";

  try {
    erpProducts = await fetchErpProducts();
  } catch (error) {
    console.error("ERPNext product fetch failed on homepage:", error);

    erpError =
      error instanceof Error
        ? error.message
        : "Unknown ERPNext product fetch error";
  }

  const normalProducts = getNormalProducts(erpProducts);

  return (
    <>
      <HeroCarousel />

      <CelebrationGrid categories={categories} />

      {erpError ? (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-800">
            <p className="text-sm font-semibold uppercase tracking-[0.3em]">
              ERPNext Error
            </p>

            <h2 className="mt-3 font-serif text-3xl">
              ERP products could not be loaded
            </h2>

            <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-2xl bg-white p-4 text-xs">
              {erpError}
            </pre>
          </div>
        </section>
      ) : (
        <>
          <SaleCollection products={erpProducts} />

          <ProductSection
            label="Fresh from our catalogue"
            title="Trendy Collection"
            products={normalProducts}
            viewAllHref="/collections/wedding"
            viewAllText="View All Products"
          />

          <FeatureStrip />

          <ProductSection
            label="Exclusive & elegant"
            title="Premium Invitations"
            products={normalProducts}
            viewAllHref="/collections/luxe"
            viewAllText="View All Premium Cards"
            shaded
          />
        </>
      )}

      <WhyUs />

      <Testimonials />
    </>
  );
}