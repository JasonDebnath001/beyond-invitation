import Link from "next/link";
import { BRAND, TAGLINE } from "./siteConfig";

const footerColumns = [
  {
    heading: "Shop",
    links: [
      { label: "All Invitations", href: "/collections/wedding" },
      { label: "Return Gifts", href: "/collections/return-gifts" },
      { label: "Luxe", href: "/collections/luxe" },
      { label: "Sale", href: "/collections/sale" },
      { label: "Custom Cards", href: "/collections/custom" },
    ],
  },
  {
    heading: "Explore",
    links: [
      { label: "Our Story", href: "/about" },
      { label: "Contact Us", href: "/contact" },
      { label: "Visit Us", href: "/stores" },
      { label: "Blogs", href: "/blog" },
      { label: "FAQs", href: "/faq" },
      { label: "Careers", href: "/careers" },
    ],
  },
  {
    heading: "More",
    links: [
      { label: "Printing Templates", href: "/printing-templates" },
      { label: "Privacy Policy", href: "/privacy-policy" },
      { label: "Refund Policy", href: "/refund-policy" },
      { label: "Shipping Policy", href: "/shipping-policy" },
      { label: "Terms & Conditions", href: "/terms-and-conditions" },
    ],
  },
];

/** Social links — swap the href values for your real profiles. */
const socials = [
  {
    label: "Instagram",
    href: "https://www.instagram.com",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5H17V3.6c-.3-.04-1.3-.13-2.5-.13-2.5 0-4.2 1.5-4.2 4.3v2.4H7.6V13h2.7v8h3.2Z" />
      </svg>
    ),
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22 8.2a3 3 0 0 0-2.1-2.1C18 5.5 12 5.5 12 5.5s-6 0-7.9.6A3 3 0 0 0 2 8.2 31 31 0 0 0 1.7 12 31 31 0 0 0 2 15.8a3 3 0 0 0 2.1 2.1c1.9.6 7.9.6 7.9.6s6 0 7.9-.6a3 3 0 0 0 2.1-2.1c.3-1.9.3-3.8.3-3.8s0-1.9-.3-3.8ZM10 15V9l5.2 3-5.2 3Z" />
      </svg>
    ),
  },
  {
    label: "Pinterest",
    href: "https://www.pinterest.com",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.1-2 .1-2.9l1.2-5s-.3-.6-.3-1.5c0-1.4.8-2.4 1.8-2.4.9 0 1.3.6 1.3 1.4 0 .9-.55 2.2-.85 3.4-.25 1 .5 1.85 1.5 1.85 1.8 0 3.1-1.9 3.1-4.6 0-2.4-1.7-4.1-4.2-4.1-2.9 0-4.6 2.15-4.6 4.4 0 .9.35 1.8.8 2.3a.3.3 0 0 1 .07.3l-.27 1.1c-.05.2-.16.25-.36.15-1.3-.6-2.1-2.5-2.1-4 0-3.25 2.35-6.25 6.8-6.25 3.55 0 6.3 2.55 6.3 5.95 0 3.55-2.2 6.4-5.3 6.4-1.05 0-2.03-.55-2.37-1.2l-.65 2.45c-.23.9-.85 2-1.27 2.7A10 10 0 1 0 12 2Z" />
      </svg>
    ),
  },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-carbon text-white">
      <div className="mx-auto max-w-7xl px-6 pb-10 pt-16 md:pt-20">
        {/* Brand + link columns */}
        <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <div className="font-display text-[24px] font-medium tracking-[0.04em] text-white">
              {BRAND}
            </div>
            <div className="mt-1.5 text-[8.5px] font-medium uppercase tracking-[0.3em] text-white/40">
              {TAGLINE}
            </div>
            <p className="mt-5 max-w-[290px] text-[13px] leading-relaxed text-white/50">
              Invitation cards tailored to your theme and finished by hand —
              exclusive designs paired with unparalleled service.
            </p>

            <div className="mt-7 flex gap-2.5">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={s.label}
                  className="flex h-9 w-9 items-center justify-center border border-white/15 text-white/55 transition-colors hover:border-white hover:bg-white hover:text-carbon"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {footerColumns.map((col) => (
            <div key={col.heading}>
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
                {col.heading}
              </h4>
              <ul className="mt-5 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[13px] text-white/55 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11.5px] tracking-wide text-white/35">
            &copy; {year} {BRAND}. All rights reserved.
          </p>
          <div className="flex gap-6 text-[11.5px] text-white/35">
            {[
              { label: "Privacy", href: "/privacy-policy" },
              { label: "Terms", href: "/terms-and-conditions" },
              { label: "Refunds", href: "/refund-policy" },
            ].map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="transition-colors hover:text-white/70"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}