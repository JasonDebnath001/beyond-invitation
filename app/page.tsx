import { getAllCategories, getAllProducts } from "@/lib/products";
import { fetchErpProducts } from "@/lib/erpnext";

import {
  BrandStatement,
  CelebrationGrid,
  FeatureStrip,
  WhyUs,
  Testimonials,
} from "@/components/Sections";

import HeroCarousel from "@/components/HeroCarousel";
import { ProductSection } from "@/components/ProductGrid";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const categories = await getAllCategories();

  let erpProducts = [];

  try {
    erpProducts = await fetchErpProducts();
  } catch (error) {
    console.error("ERPNext product fetch failed on homepage:", error);

    // Important: fallback prevents Vercel build/deploy failure
    erpProducts = await getAllProducts();
  }

  return (
    <>
      <HeroCarousel />

      <BrandStatement />

      <CelebrationGrid categories={categories} />

      <ProductSection
        label="Fresh from our catalogue"
        title="Trendy Collection"
        products={erpProducts}
        viewAllHref="/collections/wedding"
        viewAllText="View All Products"
      />

      <FeatureStrip />

      <ProductSection
        label="Exclusive & elegant"
        title="Premium Invitations"
        products={erpProducts}
        viewAllHref="/collections/luxe"
        viewAllText="View All Premium Cards"
        shaded
      />

      <WhyUs />

      <Testimonials />

    </>
  );
}