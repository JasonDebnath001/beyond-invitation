"use client";

import { useState } from "react";
import CatalogueAnimatedCard from "@/components/CatalogueAnimatedCard";
import { CATALOGUE_RANGES, type CatalogueRange } from "@/lib/catalogue-ranges";
import CatalogueModal from "./CatalogueModal";

export default function Catalogue() {
  const [selectedRange, setSelectedRange] = useState<CatalogueRange | null>(null);

  return (
    <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.35em] text-gold">
            Explore
          </p>
          <h2 className="font-serif text-3xl font-semibold uppercase tracking-[0.06em] text-carbon min-[400px]:text-4xl sm:text-5xl sm:tracking-[0.08em]">
            Catalogue
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-[2px] overflow-hidden bg-white md:grid-cols-3">
          {CATALOGUE_RANGES.map((range, index) => (
            <CatalogueAnimatedCard
              key={range.id}
              title={range.title}
              price={range.price}
              image={range.image}
              index={index}
              onClick={() => setSelectedRange(range)}
            />
          ))}
        </div>
      </div>

      {selectedRange && (
        <CatalogueModal
          key={selectedRange.id}
          range={selectedRange}
          onClose={() => setSelectedRange(null)}
        />
      )}
    </section>
  );
}
