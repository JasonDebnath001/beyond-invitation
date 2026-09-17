"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { WEDDING_FAQS } from "@/lib/wedding-cards";
import { useWeddingCardsMotion } from "@/components/wedding-cards/WeddingCardsMotion";

export default function WeddingCardsFaq() {
  const [open, setOpen] = useState<number | null>(0);
  const panels = useRef<(HTMLDivElement | null)[]>([]);
  const previous = useRef<number | null>(0);
  const motion = useWeddingCardsMotion();
  useEffect(() => {
    if (previous.current === open) return;
    panels.current.forEach((panel, index) => {
      if (panel && (index === previous.current || index === open)) {
        if (index === open) motion.expand(panel);
        else motion.collapse(panel);
      }
    });
    previous.current = open;
  }, [open, motion]);

  return <section aria-labelledby="wedding-faq-title" className="mx-auto max-w-7xl px-4 pb-12 pt-4 sm:px-6 sm:pb-16 lg:px-8">
    <h2 id="wedding-faq-title" className="text-xl font-semibold tracking-tight text-maroon">Ordering information</h2>
    <div className="mt-5 divide-y divide-carbon/10 border-y border-carbon/10">
      {WEDDING_FAQS.map(({ question, answer }, index) => <div key={question}>
        <h3><button type="button" aria-expanded={open === index} aria-controls={`wedding-faq-${index}`} onClick={() => setOpen(open === index ? null : index)} className="flex w-full items-center justify-between gap-4 py-5 text-left text-base font-semibold text-carbon">
          {question}<ChevronDown size={16} aria-hidden="true" className={`shrink-0 transition-transform motion-reduce:transition-none ${open === index ? "rotate-180" : ""}`} />
        </button></h3>
        <div id={`wedding-faq-${index}`} ref={node => { panels.current[index] = node; }} hidden={index !== 0} aria-hidden={open !== index} inert={open !== index}>
          <p className="max-w-3xl pb-6 text-base leading-8 text-ink-mid">{answer}</p>
        </div>
      </div>)}
    </div>
  </section>;
}
