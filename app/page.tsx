import { getAllCategories } from "@/lib/products";
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

/**
 * Homepage.
 * For now, both Trendy Collection and Premium Invitations show
 * all products coming from ERPNext.
 */
export default async function HomePage() {
  const [erpProducts, categories] = await Promise.all([
    fetchErpProducts(),
    getAllCategories(),
  ]);

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