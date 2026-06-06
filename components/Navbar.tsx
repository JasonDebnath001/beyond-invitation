"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import CartButton from "./CartButton";
import SearchBar from "./SearchBar";
import { BRAND, TAGLINE } from "./siteConfig";

/** A dropdown entry is either a link or a non-clickable section heading. */
type DropdownItem = { label: string; href: string } | { section: string };
/** A top-level nav item, with an optional hover dropdown. */
type NavItem = { label: string; href: string; dropdown?: DropdownItem[] };

/** Navigation structure — edit this array to change the menu. */
const navMenu: NavItem[] = [
  {
    label: "Wedding Card",
    href: "/collections/wedding-card",
    dropdown: [
      { label: "Hindu Wedding Cards", href: "/collections/wedding-card-hindu" },
      { label: "Muslim Wedding Cards", href: "/collections/wedding-card-muslim" },
      { label: "Christian Wedding Cards", href: "/collections/wedding-card-christian" },
    ],
  },
  { label: "Shagun Envelopes", href: "/collections/shagun-envelopes" },
  { label: "Shagun Boxes", href: "/collections/shagun-boxes" },
  {
    label: "Rakhi",
    href: "/collections/rakhi",
    dropdown: [
      { label: "Cards", href: "/collections/rakhi-cards" },
      { label: "Boxes", href: "/collections/rakhi-boxes" },
      { label: "Tag", href: "/collections/rakhi-tag" },
    ],
  },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeDropdownIndex, setActiveDropdownIndex] = useState<number | null>(null);

  // Close the mobile panel on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const closeMobile = () => setMobileOpen(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-neutral-200 bg-white">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-6">
        {/* Logo + wordmark */}
        <Link
          href="/"
          className="flex items-center gap-2.5"
          onClick={closeMobile}
        >
          <Image
            src="/logo.png"
            alt={BRAND}
            width={44}
            height={44}
            priority
            className="h-11 w-11 shrink-0 object-contain"
          />
          <span className="flex flex-col leading-none">
            <span className="font-display text-[19px] font-medium tracking-[0.03em] text-carbon">
              {BRAND}
            </span>
            <span className="mt-1 hidden text-[8px] font-medium uppercase tracking-[0.26em] text-neutral-400 sm:block">
              {TAGLINE}
            </span>
          </span>
        </Link>

        {/* Desktop menu */}
        <div className="hidden items-center gap-8 lg:flex">
          {navMenu.map((item, navIndex) => (
            <div
              key={item.label}
              className="group relative"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  setActiveDropdownIndex(null);
                }
              }}
            >
              <Link
                href={item.href}
                onFocus={() => item.dropdown && setActiveDropdownIndex(navIndex)}
                aria-haspopup={item.dropdown ? "menu" : undefined}
                aria-expanded={item.dropdown ? activeDropdownIndex === navIndex : undefined}
                className="flex items-center gap-1.5 py-6 text-[11.5px] font-medium uppercase tracking-[0.16em] text-carbon transition-colors hover:text-carbon"
              >
                {item.label}
                {item.dropdown && (
                  <svg
                    width="9"
                    height="9"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    aria-hidden
                  >
                    <path d="m3 4.5 3 3 3-3" />
                  </svg>
                )}
              </Link>

              {item.dropdown && (
                <div className="absolute left-1/2 top-full hidden min-w-[230px] -translate-x-1/2 animate-fadeDown border border-neutral-200 bg-white p-1.5 shadow-[0_16px_44px_rgba(90,18,32,0.14)] group-hover:block group-focus-within:block">
                  {item.dropdown.map((d, i) =>
                    "section" in d ? (
                      <div
                        key={`sec-${i}`}
                        className="px-3.5 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400"
                      >
                        {d.section}
                      </div>
                    ) : (
                      <Link
                        key={d.label}
                        href={d.href}
                        className="block px-3.5 py-2 text-[12.5px] text-neutral-600 transition-colors hover:bg-paper hover:text-carbon"
                      >
                        {d.label}
                      </Link>
                    ),
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right-side actions */}
        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <SearchBar />
          </div>

          <Show when="signed-out">
            <SignInButton mode="modal">
              <button
                type="button"
                className="hidden border border-carbon px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-carbon transition-colors hover:bg-carbon hover:text-white sm:block"
              >
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button
                type="button"
                className="hidden bg-carbon px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white transition-colors hover:bg-carbon-dark lg:block"
              >
                Sign Up
              </button>
            </SignUpButton>
          </Show>

          <Show when="signed-in">
            <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
          </Show>

          <CartButton />

          {/* Hamburger — mobile only */}
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="flex h-10 w-10 items-center justify-center text-carbon transition-colors hover:bg-paper lg:hidden"
          >
            {mobileOpen ? (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      {mobileOpen && (
        <div className="absolute inset-x-0 top-full max-h-[calc(100vh-72px)] overflow-y-auto border-b border-neutral-200 bg-white lg:hidden">
          <div className="px-6 py-5">
            {/* Search (native GET form → /search) */}
            <form action="/search" className="mb-5">
              <div className="relative flex items-center">
                <span className="pointer-events-none absolute left-3 text-neutral-400">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                </span>
                <input
                  type="text"
                  name="q"
                  placeholder="Search cards"
                  aria-label="Search products"
                  className="w-full border border-neutral-300 bg-white py-2.5 pl-9 pr-3 text-[13px] text-carbon placeholder:text-neutral-400 focus:border-carbon focus:outline-none"
                />
              </div>
            </form>

            {/* Nav links */}
            {navMenu.map((item) => (
              <div
                key={item.label}
                className="border-b border-neutral-100 py-1 last:border-0"
              >
                <Link
                  href={item.href}
                  onClick={closeMobile}
                  className="block py-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-carbon"
                >
                  {item.label}
                </Link>
                {item.dropdown && (
                  <div className="pb-2 pl-3.5">
                    {item.dropdown.map((d, i) =>
                      "section" in d ? null : (
                        <Link
                          key={d.label}
                          href={d.href}
                          onClick={closeMobile}
                          className="block py-1.5 text-[13px] text-neutral-500 transition-colors hover:text-carbon"
                        >
                          {d.label}
                        </Link>
                      ),
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Auth */}
            <div className="flex flex-wrap gap-3 pt-5">
              <Show when="signed-out">
                <SignInButton mode="modal">
                  <button
                    type="button"
                    className="flex-1 border border-carbon px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-carbon transition-colors hover:bg-carbon hover:text-white"
                  >
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button
                    type="button"
                    className="flex-1 bg-carbon px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition-colors hover:bg-carbon-dark"
                  >
                    Sign Up
                  </button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
              </Show>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}