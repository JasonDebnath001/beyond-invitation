import {
  getSaleProducts,
  getPremiumProducts,
  getAllCategories,
} from "@/lib/products";
import {
  CelebrationGrid,
  FeatureStrip,
  WhyUs,
  Testimonials,
  Milestones,
} from "@/components/Sections";
import HeroCarousel from "@/components/HeroCarousel";
import { ProductSection } from "@/components/ProductGrid";

/**
 * Homepage. A server component — data is fetched on the server at build /
 * request time. No client-side data loading, fast first paint.
 */
export default async function HomePage() {
  const [saleProducts, premiumProducts, categories] = await Promise.all([
    getSaleProducts(),
    getPremiumProducts(),
    getAllCategories(),
  ]);

  return (
    <>
      <HeroCarousel />
      <CelebrationGrid categories={categories} />
      <FeatureStrip />

      <ProductSection
        label="Limited time offers"
        title="🔥 Sale Collection"
        products={saleProducts}
        viewAllHref="/collections/wedding"
        viewAllText="View All Sale Items"
      />

      <ProductSection
        label="Exclusive & Elegant"
        title="Premium Invitations"
        products={premiumProducts}
        viewAllHref="/collections/wedding"
        viewAllText="View All Premium Invitations"
        shaded
      />

      <WhyUs />
      <Testimonials />
      <Milestones />
    </>
  );
}