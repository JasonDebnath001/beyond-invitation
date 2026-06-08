"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import CartButton from "./CartButton";
import SearchBar from "./SearchBar";
import { BRAND, TAGLINE } from "./siteConfig";

type DropdownItem =
  | {
      label: string;
      href: string;
    }
  | {
      section: string;
    };

type NavItem = {
  label: string;
  href: string;
  dropdown?: DropdownItem[];
};

const navMenu: NavItem[] = [
  {
    label: "Wedding Card",
    href: "/collections/wedding-card",
    dropdown: [
      {
        label: "Hindu Wedding Cards",
        href: "/collections/wedding-card-hindu",
      },
      {
        label: "Muslim Wedding Cards",
        href: "/collections/wedding-card-muslim",
      },
      {
        label: "Christian Wedding Cards",
        href: "/collections/wedding-card-christian",
      },
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
      {
        label: "Cards",
        href: "/collections/rakhi-cards",
      },
      {
        label: "Boxes",
        href: "/collections/rakhi-boxes",
      },
      {
        label: "Tag",
        href: "/collections/rakhi-tag",
      },
    ],
  },
];

function DesktopAuthButtons() {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return null;
  }

  if (isSignedIn) {
    return (
      <div className="flex items-center gap-4">
        <Link
          href="/my-orders"
          className="text-sm font-semibold text-carbon transition hover:text-maroon"
        >
          My Orders
        </Link>

        <UserButton afterSignOutUrl="/" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <SignInButton mode="modal">
        <button className="rounded-full px-4 py-2 text-sm font-semibold text-carbon transition hover:bg-paper">
          Sign In
        </button>
      </SignInButton>

      <SignUpButton mode="modal">
        <button className="rounded-full bg-maroon px-4 py-2 text-sm font-semibold text-white transition hover:bg-maroon-dark">
          Sign Up
        </button>
      </SignUpButton>
    </div>
  );
}

function MobileAuthButtons({ closeMobile }: { closeMobile: () => void }) {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return null;
  }

  if (isSignedIn) {
    return (
      <div className="space-y-2 border-t border-gold/20 pt-4">
        <Link
          href="/my-orders"
          onClick={closeMobile}
          className="block rounded-xl px-3 py-2 text-sm font-semibold text-carbon hover:bg-paper"
        >
          My Orders
        </Link>

        <Link
          href="/account"
          onClick={closeMobile}
          className="block rounded-xl px-3 py-2 text-sm font-semibold text-carbon hover:bg-paper"
        >
          Account
        </Link>

        <div className="px-3 py-2">
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 border-t border-gold/20 pt-4">
      <SignInButton mode="modal">
        <button
          onClick={closeMobile}
          className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-carbon hover:bg-paper"
        >
          Sign In
        </button>
      </SignInButton>

      <SignUpButton mode="modal">
        <button
          onClick={closeMobile}
          className="block w-full rounded-xl bg-maroon px-3 py-2 text-left text-sm font-semibold text-white hover:bg-maroon-dark"
        >
          Sign Up
        </button>
      </SignUpButton>
    </div>
  );
}

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeDropdownIndex, setActiveDropdownIndex] = useState<number | null>(
    null,
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        setActiveDropdownIndex(null);
      }
    }

    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const closeMobile = () => {
    setMobileOpen(false);
    setActiveDropdownIndex(null);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-gold/20 bg-white/95 shadow-sm backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 lg:px-8">
        {/* Logo + wordmark */}
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-gold/30 bg-white">
            <Image
              src="/logo.png"
              alt={BRAND}
              fill
              className="object-contain p-1"
              sizes="48px"
              priority
            />
          </div>

          <div className="min-w-0">
            <p className="truncate font-serif text-xl font-semibold text-maroon">
              {BRAND}
            </p>

            <p className="hidden truncate text-xs uppercase tracking-[0.2em] text-gold sm:block">
              {TAGLINE}
            </p>
          </div>
        </Link>

        {/* Desktop menu */}
        <div className="hidden items-center gap-1 lg:flex">
          {navMenu.map((item, navIndex) => (
            <div
              key={item.label}
              className="relative"
              onMouseEnter={() => {
                if (item.dropdown) {
                  setActiveDropdownIndex(navIndex);
                }
              }}
              onMouseLeave={() => setActiveDropdownIndex(null)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  setActiveDropdownIndex(null);
                }
              }}
            >
              <Link
                href={item.href}
                className="flex items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold text-carbon transition hover:bg-paper hover:text-maroon"
              >
                {item.label}

                {item.dropdown && (
                  <span className="text-xs text-gold" aria-hidden="true">
                    ▾
                  </span>
                )}
              </Link>

              {item.dropdown && activeDropdownIndex === navIndex && (
                <div className="absolute left-0 top-full min-w-56 rounded-2xl border border-gold/20 bg-white p-2 shadow-xl">
                  {item.dropdown.map((dropdownItem, index) =>
                    "section" in dropdownItem ? (
                      <p
                        key={`${dropdownItem.section}-${index}`}
                        className="px-3 py-2 text-xs uppercase tracking-[0.2em] text-gold"
                      >
                        {dropdownItem.section}
                      </p>
                    ) : (
                      <Link
                        key={dropdownItem.href}
                        href={dropdownItem.href}
                        className="block rounded-xl px-3 py-2 text-sm font-medium text-carbon transition hover:bg-paper hover:text-maroon"
                      >
                        {dropdownItem.label}
                      </Link>
                    ),
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right-side actions */}
        <div className="hidden items-center gap-4 lg:flex">
          <SearchBar />
          <CartButton />
          <DesktopAuthButtons />
        </div>

        {/* Mobile actions */}
        <div className="flex items-center gap-3 lg:hidden">
          <CartButton />

          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="flex h-10 w-10 items-center justify-center rounded-full text-carbon transition-colors hover:bg-paper"
          >
            {mobileOpen ? (
              <span className="text-2xl leading-none">×</span>
            ) : (
              <span className="text-2xl leading-none">☰</span>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile panel */}
      {mobileOpen && (
        <div className="border-t border-gold/20 bg-white px-4 py-4 shadow-lg lg:hidden">
          <div className="mx-auto max-w-7xl space-y-4">
            <SearchBar />

            <div className="space-y-1">
              {navMenu.map((item) => (
                <div key={item.label}>
                  <Link
                    href={item.href}
                    onClick={closeMobile}
                    className="block rounded-xl px-3 py-2 text-sm font-semibold text-carbon hover:bg-paper"
                  >
                    {item.label}
                  </Link>

                  {item.dropdown && (
                    <div className="ml-4 border-l border-gold/20 pl-3">
                      {item.dropdown.map((dropdownItem, index) =>
                        "section" in dropdownItem ? null : (
                          <Link
                            key={`${dropdownItem.href}-${index}`}
                            href={dropdownItem.href}
                            onClick={closeMobile}
                            className="block rounded-xl px-3 py-2 text-sm text-ink-light hover:bg-paper hover:text-maroon"
                          >
                            {dropdownItem.label}
                          </Link>
                        ),
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <MobileAuthButtons closeMobile={closeMobile} />
          </div>
        </div>
      )}
    </header>
  );
}