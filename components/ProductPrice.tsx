import type { Product } from "@/types";

type ProductPriceProps = Pick<Product, "price"> & {
  mrp?: number;
  priceClassName?: string;
  oldPriceClassName?: string;
  unavailableLabel?: string;
};

/** The old price is informational; cart totals always use the selling price. */
export default function ProductPrice({
  price,
  mrp = price,
  priceClassName = "",
  oldPriceClassName = "text-ink-light",
  unavailableLabel,
}: ProductPriceProps) {
  const hasPrice = Number.isFinite(price) && price > 0;
  const showOldPrice = hasPrice && Number.isFinite(mrp) && mrp > price;
  const formatPrice = (value: number) =>
    `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

  return (
    <>
      <span className={priceClassName}>
        {hasPrice || !unavailableLabel ? (
          <>
            <span className="sr-only">Current price: </span>
            {formatPrice(price)}
          </>
        ) : unavailableLabel}
      </span>
      {showOldPrice && (
        <del className={`whitespace-nowrap line-through ${oldPriceClassName}`}>
          <span className="sr-only">Old price: </span>
          {formatPrice(mrp)}
        </del>
      )}
    </>
  );
}
