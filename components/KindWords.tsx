"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const reviews = [
  {
    name: "Aishwarya & Nikhil, Kolkata",
    image: "/reviews/reviews1.png",
    text: "Our wedding invitation cards turned out beautiful and elegant. The quality of paper and print was really good, and everything was delivered on time. We are happy we chose Beyond Invitation for such an important part of our wedding.",
  },
  {
    name: "Ritika & Arjun, Kolkata",
    image: "/reviews/reviews2.png",
    text: "The designs were premium, the finishing was neat, and the team helped us select the perfect card within our budget. Our family loved the invitations.",
  },
  {
    name: "Priya & Sayan, Kolkata",
    image: "/reviews/reviews3.png",
    text: "Very professional service and beautiful card collections. From selection to delivery, the whole experience was smooth and reliable.",
  },
];

export default function KindWords() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    if (paused) return;

    const interval = setInterval(() => {
      setFade(false);

      const timeout = setTimeout(() => {
        setActive((current) => (current + 1) % reviews.length);
        setFade(true);
      }, 300);

      return () => clearTimeout(timeout);
    }, 3000);

    return () => clearInterval(interval);
  }, [paused]);

  const review = reviews[active];

  return (
    <section
      className="bg-white py-16 sm:py-20"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.35em] text-gold">
            Testimonials
          </p>

          <h2 className="font-serif text-4xl font-semibold uppercase tracking-[0.08em] text-carbon sm:text-5xl">
            Kind Words
          </h2>
        </div>

        <div className="overflow-hidden bg-white">
          <div
            className={`grid min-h-[520px] transition-opacity duration-300 lg:grid-cols-2 ${
              fade ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="relative min-h-[420px] overflow-hidden lg:min-h-[560px]">
              <Image
                src={review.image}
                alt={review.name}
                fill
                priority={active === 0}
                className="object-cover"
              />
            </div>

            <div className="flex items-center px-6 py-12 sm:px-10 lg:px-16">
              <div className="max-w-2xl">
                <h3 className="mb-5 text-3xl font-semibold tracking-wide text-carbon sm:text-4xl lg:text-5xl">
                  {review.name}
                </h3>

                <div
                  className="mb-6 flex gap-1 text-2xl text-gold"
                  aria-label="5 star rating"
                >
                  <span>★</span>
                  <span>★</span>
                  <span>★</span>
                  <span>★</span>
                  <span>★</span>
                </div>

                <p className="text-base leading-8 text-carbon/70 sm:text-lg">
                  {review.text}
                </p>

                <div className="mt-10 flex gap-3">
                  {reviews.map((item, index) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => {
                        setActive(index);
                        setFade(true);
                      }}
                      aria-label={`Show review ${index + 1}`}
                      className={`h-2.5 rounded-full transition-all ${
                        active === index
                          ? "w-10 bg-carbon"
                          : "w-2.5 bg-carbon/25 hover:bg-carbon/50"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}