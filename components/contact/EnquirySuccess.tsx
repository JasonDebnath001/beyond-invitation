"use client";

import { useEffect, useRef } from "react";
import { useContactMotion } from "@/components/contact/ContactMotion";

export default function EnquirySuccess({
  name,
  mobile,
  whatsappUrl,
  onReset,
}: {
  name: string;
  mobile: string;
  whatsappUrl: string;
  onReset: () => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const motion = useContactMotion();

  useEffect(() => {
    if (svgRef.current) motion.drawCheck(svgRef.current);
    panelRef.current?.focus({ preventScroll: true });
  }, [motion]);

  return (
    <div
      ref={panelRef}
      role="status"
      tabIndex={-1}
      data-enquiry-success
      className="py-10 text-center outline-none sm:py-16"
    >
      <svg
        ref={svgRef}
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
        className="mx-auto h-16 w-16 text-carbon"
      >
        <circle
          cx="32"
          cy="32"
          r="28"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="m20 32 8 8 16-17"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div data-success-content>
      <h2
        className="mt-6 text-3xl font-light tracking-tight text-maroon outline-none"
      >
        Thank you, {name.trim().split(/\s+/)[0] || "there"}.
      </h2>
      <p className="mt-3 text-base leading-8 text-ink-mid">
        {mobile
          ? `Our team will contact you on +91 ${mobile}.`
          : "Our team will be in touch."}
      </p>
      <div className="mt-8 flex flex-col items-stretch gap-3">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-carbon px-6 py-3 text-sm font-semibold text-white transition hover:bg-carbon-dark"
        >
          Chat on WhatsApp
        </a>
        <button
          type="button"
          onClick={onReset}
          className="rounded-full border border-carbon/20 bg-white px-6 py-3 text-sm font-semibold text-carbon transition hover:bg-paper"
        >
          Send another enquiry
        </button>
      </div>
      </div>
    </div>
  );
}
