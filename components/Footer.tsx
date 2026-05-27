import Link from "next/link";

const footerColumns = [
  {
    heading: "Shop",
    links: ["All Invitations", "Return Gifts", "Luxe", "Sale", "Custom Cards"],
  },
  {
    heading: "Explore",
    links: ["Our Story", "Contact Us", "Visit Us", "Blogs", "FAQs", "Careers"],
  },
  {
    heading: "More",
    links: [
      "Printing Templates",
      "Privacy Policy",
      "Refund Policy",
      "Shipping Policy",
      "Terms & Conditions",
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-maroon-dark px-6 pb-8 pt-14 text-white/80">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 grid grid-cols-2 gap-12 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <div className="font-display text-[22px] font-bold text-gold-light">
              Shahi Cards
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.15em] text-gold/60">
              Wedding Invitation Specialists
            </div>
            <p className="mt-2.5 max-w-[260px] text-[13px] leading-relaxed text-white/60">
              Invitation cards tailored to your theme with top-quality design.
              Unparalleled service meets exclusive designs.
            </p>
            <div className="mt-5 flex gap-2.5">
              {["f", "in", "▶", "📌"].map((s) => (
                <span
                  key={s}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold/30 text-[14px] text-gold-light transition hover:border-gold hover:bg-gold hover:text-maroon-dark"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          {footerColumns.map((col) => (
            <div key={col.heading}>
              <h4 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.1em] text-gold-light">
                {col.heading}
              </h4>
              {col.links.map((link) => (
                <Link
                  key={link}
                  href="/"
                  className="mb-2.5 block text-[13px] text-white/60 transition hover:text-gold-light"
                >
                  {link}
                </Link>
              ))}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gold/15 pt-6">
          <p className="text-[12px] text-white/40">
            © {new Date().getFullYear()} Shahi Cards. All Rights Reserved.
          </p>
          <div className="flex gap-4 text-[12px] text-white/40">
            <Link href="/">Privacy</Link>
            <Link href="/">Terms</Link>
            <Link href="/">Refunds</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
