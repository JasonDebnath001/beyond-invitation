export const CATALOGUE_RANGES = [
  {
    id: "affordable",
    title: "Affordable",
    price: "MRP below ₹50",
    image: "/collections/cat1.png",
    min: 0,
    max: 50,
    inclusiveMax: false,
  },
  {
    id: "mid-range",
    title: "Mid-range",
    price: "MRP ₹50 to under ₹150",
    image: "/collections/cat2.png",
    min: 50,
    max: 150,
    inclusiveMax: false,
  },
  {
    id: "premium",
    title: "Premium",
    price: "MRP ₹150 to ₹300",
    image: "/collections/cat3.png",
    min: 150,
    max: 300,
    inclusiveMax: true,
  },
] as const;

export type CatalogueRange = (typeof CATALOGUE_RANGES)[number];
export type CatalogueRangeId = CatalogueRange["id"];

export function getCatalogueRange(id: string | null) {
  return CATALOGUE_RANGES.find((range) => range.id === id);
}

/** MRP bands do not overlap; products without a valid MRP have no price band. */
export function isInCatalogueRange(mrp: number, range: CatalogueRange) {
  return Number.isFinite(mrp) && mrp > 0 && mrp >= range.min &&
    (range.inclusiveMax ? mrp <= range.max : mrp < range.max);
}
