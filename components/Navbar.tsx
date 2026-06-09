"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Show, SignInButton, UserButton, useUser } from "@clerk/nextjs";

import CartButton from "./CartButton";
import SearchBar from "./SearchBar";
import WishlistNavLink from "./WishlistNavLink";
import { BRAND, TAGLINE } from "./siteConfig";

type DropdownItem = { label: string; href: string } | { section: string };

type NavItem = {
  label: string;
  href?: string;
  dropdown?: DropdownItem[];
};

const navMenu: NavItem[] = [
  {
    label: "Wedding Card",
    dropdown: [
      { label: "Hindu Wedding Cards", href: "/collections/wedding-card-hindu" },
      { label: "Muslim Wedding Cards", href: "/collections/wedding-card-muslim" },
      { label: "Christian Wedding Cards", href: "/collections/wedding-card-christian" },
    ],
  },
  {
    label: "Shagun Envelopes",
    href: "/collections/shagun-envelopes",
  },
  {
    label: "Shagun Boxes",
    href: "/collections/shagun-boxes",
  },
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
  const { isLoaded, isSignedIn } = useUser();
  const pathname = usePathname();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeDropdownIndex, setActiveDropdownIndex] = useState<number | null>(null);

  const closeMobile = () => setMobileOpen(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileOpen(false);
        setActiveDropdownIndex(null);
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setActiveDropdownIndex(null);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-carbon/10 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3 py-3" onClick={closeMobile}>
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-paper">
            <Image
              src="/logo.png"
              alt={BRAND}
              fill
              sizes="44px"
              className="object-contain"
              priority
            />
          </div>

          <div className="min-w-0">
            <div className="truncate text-base font-semibold tracking-wide text-carbon">
              {BRAND}
            </div>
            <div className="hidden truncate text-[11px] uppercase tracking-[0.16em] text-carbon/55 sm:block">
              {TAGLINE}
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {navMenu.map((item, navIndex) => {
            const hasDropdown = Boolean(item.dropdown?.length);

            return (
              <div
                key={`${item.label}-${navIndex}`}
                className="relative"
                onMouseEnter={() => hasDropdown && setActiveDropdownIndex(navIndex)}
                onMouseLeave={() => setActiveDropdownIndex(null)}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                    setActiveDropdownIndex(null);
                  }
                }}
              >
                {hasDropdown ? (
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={activeDropdownIndex === navIndex}
                    className="flex items-center gap-1.5 py-6 text-[11.5px] font-medium uppercase tracking-[0.16em] text-carbon transition-colors hover:text-carbon/70"
                  >
                    {item.label}
                    <span
                      aria-hidden="true"
                      className={`text-xs transition-transform ${
                        activeDropdownIndex === navIndex ? "rotate-180" : ""
                      }`}
                    >
                      ▾
                    </span>
                  </button>
                ) : item.href ? (
                  <Link
                    href={item.href}
                    className="flex items-center gap-1.5 py-6 text-[11.5px] font-medium uppercase tracking-[0.16em] text-carbon transition-colors hover:text-carbon/70"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="flex items-center gap-1.5 py-6 text-[11.5px] font-medium uppercase tracking-[0.16em] text-carbon">
                    {item.label}
                  </span>
                )}

                {hasDropdown && activeDropdownIndex === navIndex && (
                  <div
                    role="menu"
                    className="absolute left-0 top-full w-max min-w-56 rounded-2xl border border-carbon/10 bg-white p-2 shadow-xl"
                  >
                    {item.dropdown?.map((d, i) =>
                      "section" in d ? (
                        <div
                          key={`${item.label}-section-${i}`}
                          className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-carbon/45"
                        >
                          {d.section}
                        </div>
                      ) : (
                        <Link
                          key={`${d.label}-${d.href}-${i}`}
                          href={d.href}
                          role="menuitem"
                          className="block rounded-xl px-3 py-2 text-sm text-carbon transition hover:bg-paper"
                        >
                          {d.label}
                        </Link>
                      ),
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <SearchBar />
          <WishlistNavLink />
          <CartButton />

          <Show when={() => isLoaded && isSignedIn}>
            <UserButton />
          </Show>

          <Show when={() => isLoaded && !isSignedIn}>
            <SignInButton mode="modal">
              <button className="rounded-full bg-carbon px-4 py-2 text-sm font-semibold text-white transition hover:bg-carbon/85">
                Sign In
              </button>
            </SignInButton>
          </Show>
        </div>

        <div className="flex items-center gap-3 lg:hidden">
          <CartButton />

          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="flex h-10 w-10 items-center justify-center rounded-full text-carbon transition-colors hover:bg-paper"
          >
            <span aria-hidden="true" className="text-2xl leading-none">
              {mobileOpen ? "×" : "☰"}
            </span>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-carbon/10 bg-white px-4 py-5 shadow-xl lg:hidden">
          <div className="mx-auto max-w-7xl space-y-5">
            <SearchBar />

            <nav className="space-y-2">
              {navMenu.map((item, index) => (
                <div key={`${item.label}-${index}`} className="rounded-2xl bg-paper/60 p-3">
                  {item.href ? (
                    <Link
                      href={item.href}
                      onClick={closeMobile}
                      className="block text-sm font-semibold uppercase tracking-[0.12em] text-carbon"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <div className="block text-sm font-semibold uppercase tracking-[0.12em] text-carbon">
                      {item.label}
                    </div>
                  )}

                  {item.dropdown && (
                    <div className="mt-3 space-y-2 border-l border-carbon/15 pl-3">
                      {item.dropdown.map((d, i) =>
                        "section" in d ? (
                          <div
                            key={`${item.label}-mobile-section-${i}`}
                            className="text-xs font-semibold uppercase tracking-[0.12em] text-carbon/45"
                          >
                            {d.section}
                          </div>
                        ) : (
                          <Link
                            key={`${d.label}-${d.href}-${i}`}
                            href={d.href}
                            onClick={closeMobile}
                            className="block text-sm text-carbon/75"
                          >
                            {d.label}
                          </Link>
                        ),
                      )}
                    </div>
                  )}
                </div>
              ))}

              <div className="rounded-2xl bg-paper/60 p-3" onClick={closeMobile}>
                <WishlistNavLink />
              </div>
            </nav>

            <div className="flex items-center gap-3 border-t border-carbon/10 pt-4">
              <Show when={() => isLoaded && isSignedIn}>
                <UserButton />
              </Show>

              <Show when={() => isLoaded && !isSignedIn}>
                <SignInButton mode="modal">
                  <button
                    onClick={closeMobile}
                    className="rounded-full bg-carbon px-4 py-2 text-sm font-semibold text-white"
                  >
                    Sign In
                  </button>
                </SignInButton>
              </Show>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}