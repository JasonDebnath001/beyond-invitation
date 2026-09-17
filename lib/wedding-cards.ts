export type BrowserProduct = {
  slug: string;
  designNo: string;
  name: string;
  price: number;
  mrp: number;
  image: string;
  imageCount: number;
  subject: string;
  itemGroup: string;
  hasPrice: boolean;
  minOrderQty: number | null;
  updatedAt: string;
};

export const PRICE_BUCKETS = [
  { value: "under-25", label: "Under ₹25" },
  { value: "25-50", label: "₹25 – ₹50" },
  { value: "50-100", label: "₹50 – ₹100" },
  { value: "above-100", label: "Above ₹100" },
  { value: "on-request", label: "Price on request" },
] as const;
export const WEDDING_SORTS = [
  { value: "recommended", label: "Recommended" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "newest", label: "Newest" },
] as const;
export type WeddingSort = (typeof WEDDING_SORTS)[number]["value"];
export type PriceBucket = (typeof PRICE_BUCKETS)[number]["value"];
export type WeddingFilters = {
  type: "all" | "hindu" | "muslim" | "christian";
  text: string;
  price: "any" | PriceBucket;
  sort: WeddingSort;
};

export const DEFAULT_WEDDING_FILTERS: WeddingFilters = {
  type: "all",
  text: "",
  price: "any",
  sort: "recommended",
};
const CARD_TYPES = [
  { value: "hindu", label: "Hindu", subject: "hindu wedding card" },
  { value: "muslim", label: "Muslim", subject: "muslim wedding card" },
  { value: "christian", label: "Christian", subject: "christian wedding card" },
] as const;
// Kept local so this pure, browser-safe module never imports the server catalogue.
const STOREFRONT_SUBJECTS = new Set([
  "wedding card",
  ...CARD_TYPES.map((item) => item.subject),
  "shagun envelopes",
  "wedding box",
  "rakhi",
]);
const normalizedSubject = (product: BrowserProduct) =>
  product.subject.trim().toLowerCase();
const hasPrice = (price: number) => Number.isFinite(price) && price > 0;

export function priceBucketFor(price: number): PriceBucket {
  if (!hasPrice(price)) return "on-request";
  if (price < 25) return "under-25";
  if (price < 50) return "25-50";
  if (price <= 100) return "50-100";
  return "above-100";
}

export function parseWeddingFilters(
  params: Pick<URLSearchParams, "get">,
): WeddingFilters {
  const type = params.get("type");
  const price = params.get("price");
  const sort = params.get("sort");
  return {
    type: CARD_TYPES.some((item) => item.value === type)
      ? (type as WeddingFilters["type"])
      : "all",
    text: (params.get("text") || "").trim().slice(0, 100),
    price: PRICE_BUCKETS.some((item) => item.value === price)
      ? (price as PriceBucket)
      : "any",
    sort: WEDDING_SORTS.some((item) => item.value === sort)
      ? (sort as WeddingSort)
      : "recommended",
  };
}

export function serializeWeddingFilters(filters: WeddingFilters) {
  const params = new URLSearchParams();
  if (filters.type !== "all") params.set("type", filters.type);
  if (filters.text) params.set("text", filters.text);
  if (filters.price !== "any") params.set("price", filters.price);
  if (filters.sort !== "recommended") params.set("sort", filters.sort);
  return params.toString();
}

export function applyWeddingFilters(
  products: BrowserProduct[],
  filters: WeddingFilters,
) {
  const type = CARD_TYPES.find((item) => item.value === filters.type);
  return products.filter((product) => {
    const subject = normalizedSubject(product);
    return (
      (!type || subject === type.subject) &&
      (!filters.text ||
        (!STOREFRONT_SUBJECTS.has(subject) &&
          subject === filters.text.toLowerCase())) &&
      (filters.price === "any" ||
        priceBucketFor(product.price) === filters.price)
    );
  });
}

export function sortWeddingProducts(
  products: BrowserProduct[],
  sort: WeddingSort,
) {
  const result = [...products];
  if (sort === "recommended") return result;
  return result.sort((a, b) => {
    if (sort === "newest")
      return (
        (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0) ||
        a.slug.localeCompare(b.slug, "en")
      );
    const priceDifference =
      Number(hasPrice(b.price)) - Number(hasPrice(a.price));
    if (priceDifference) return priceDifference;
    if (!hasPrice(a.price)) return 0;
    return sort === "price-desc" ? b.price - a.price : a.price - b.price;
  });
}

export function facetCounts(products: BrowserProduct[]) {
  const types = CARD_TYPES.map((item) => ({
    value: item.value,
    label: item.label,
    count: products.filter(
      (product) => normalizedSubject(product) === item.subject,
    ).length,
  })).filter((item) => item.count > 0);
  const textCounts = new Map<
    string,
    { value: string; label: string; count: number }
  >();
  for (const product of products) {
    const subject = normalizedSubject(product);
    if (!subject || STOREFRONT_SUBJECTS.has(subject)) continue;
    const existing = textCounts.get(subject);
    if (existing) existing.count++;
    else
      textCounts.set(subject, {
        value: product.subject.trim(),
        label: product.subject.trim(),
        count: 1,
      });
  }
  const text = [...textCounts.values()].sort((a, b) =>
    a.label.localeCompare(b.label, "en"),
  );
  const prices = PRICE_BUCKETS.map((item) => ({
    ...item,
    count: products.filter(
      (product) => priceBucketFor(product.price) === item.value,
    ).length,
  })).filter((item) => item.count > 0);
  return {
    total: products.length,
    types,
    text,
    prices,
    showType: types.length >= 2,
    showText: text.length >= 2,
    showPrice: prices.length >= 2,
  };
}

export const WEDDING_FAQS = [
  {
    question: "Where can I buy wedding cards in Kolkata?",
    answer:
      "Visit Beyond Invitation at our Kolkata showroom to see wedding card samples and compare printing and finishes. You can also browse the collection online and send us an enquiry.",
  },
  {
    question: "Are wedding cards available for delivery outside Kolkata?",
    answer:
      "Yes. We deliver across India, with timelines depending on your location, printing requirements and order.",
  },
  {
    question: "What types of wedding cards are available?",
    answer:
      "Our range includes Hindu, Muslim and Christian wedding invitations, with traditional and contemporary designs. Speak with our team about printed text and finishes for your celebration.",
  },
] as const;
