import Link from "next/link";
import { BRAND, TAGLINE } from "./siteConfig";

const footerColumns = [
  {
    heading: "Explore",
    links: [
      { label: "Our Story", href: "/about" },
      { label: "Contact Us", href: "/contact" },
      { label: "Visit Us", href: "/visit-us" },
      { label: "Blogs", href: "/blog" },
      { label: "FAQs", href: "/faq" },
    ],
  },
  {
    heading: "More",
    links: [
      { label: "Privacy Policy", href: "/privacy-policy" },
      { label: "Refund Policy", href: "/refund-policy" },
      { label: "Shipping Policy", href: "/shipping-policy" },
      { label: "Terms & Conditions", href: "/terms-and-conditions" },
    ],
  },
];

const socials = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/beyond_invitationofficial/",
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
    href: "https://www.facebook.com/weddingcardsmanufacturer2022",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5H17V3.6c-.3-.04-1.3-.13-2.5-.13-2.5 0-4.2 1.5-4.2 4.3v2.4H7.6V13h2.7v8h3.2Z" />
      </svg>
    ),
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@BeyondInvitation",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22 8.2a3 3 0 0 0-2.1-2.1C18 5.5 12 5.5 12 5.5s-6 0-7.9.6A3 3 0 0 0 2 8.2 31 31 0 0 0 1.7 12 31 31 0 0 0 2 15.8a3 3 0 0 0 2.1 2.1c1.9.6 7.9.6 7.9.6s6 0 7.9-.6a3 3 0 0 0 2.1-2.1c.3-1.9.3-3.8.3-3.8s0-1.9-.3-3.8ZM10 15V9l5.2 3-5.2 3Z" />
      </svg>
    ),
  },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden bg-carbon text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.04),transparent_45%)]" />

      <div className="relative mx-auto max-w-7xl px-6 pb-8 pt-16 md:pt-20">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr] lg:gap-16">
          <div className="md:border-r md:border-white/10 md:pr-12">
            <div className="font-display text-[26px] font-medium tracking-[0.04em] text-white">
              {BRAND}
            </div>

            <div className="mt-2 flex items-center gap-3">
              <span className="h-px w-8 bg-[#d6b36a]" />
              <div className="text-[9px] font-medium uppercase tracking-[0.34em] text-white/45">
                {TAGLINE}
              </div>
              <span className="h-px w-8 bg-[#d6b36a]" />
            </div>

            <p className="mt-6 max-w-[310px] text-[14px] leading-7 text-white/62">
              Invitation cards tailored to your theme and finished by hand —
              exclusive designs paired with unparalleled service.
            </p>

            <div className="mt-8 flex gap-4">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={s.label}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d6b36a]/70 text-[#f0d99b] transition-all hover:bg-[#d6b36a] hover:text-carbon"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {footerColumns.map((col) => (
            <div key={col.heading} className="md:border-r md:border-white/10 md:pr-10 last:border-r-0">
              <h4 className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#f0d99b]">
                {col.heading}
              </h4>

              <ul className="mt-6 space-y-4">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="group inline-flex items-center gap-3 text-[14px] text-white/65 transition-colors hover:text-white"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-[#d6b36a]/60 transition-all group-hover:w-4 group-hover:rounded-full group-hover:bg-[#d6b36a]" />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 border-t border-white/10 pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] tracking-wide text-white/40">
              &copy; {year} {BRAND}. All rights reserved.
            </p>

            <p className="text-[13px] font-medium tracking-wide text-[#f0d99b]">
              Crafted with elegance for every celebration.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}