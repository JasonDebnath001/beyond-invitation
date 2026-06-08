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
      <UserButton
        appearance={{
          elements: {
            avatarBox: "h-8 w-8",
          },
        }}
      />
    );
  }

  return (
    <div className="hidden items-center gap-2 xl:flex">
      <SignInButton mode="modal">
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center whitespace-nowrap border border-carbon px-3.5 text-center text-[10px] font-semibold uppercase leading-none tracking-[0.08em] text-carbon transition-colors hover:bg-carbon hover:text-white"
        >
          Sign In
        </button>
      </SignInButton>

      <SignUpButton mode="modal">
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center whitespace-nowrap bg-carbon px-3.5 text-center text-[10px] font-semibold uppercase leading-none tracking-[0.08em] text-white transition-colors hover:bg-carbon-dark"
        >
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
      <Link
        href="/account"
        onClick={closeMobile}
        className="inline-flex h-10 w-full items-center justify-center border border-carbon px-3 text-center text-[10.5px] font-semibold uppercase leading-none tracking-[0.08em] text-carbon transition-colors hover:bg-carbon hover:text-white"
      >
        Account
      </Link>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <SignInButton mode="modal">
        <button
          type="button"
          onClick={closeMobile}
          className="inline-flex h-10 w-full items-center justify-center whitespace-nowrap border border-carbon px-3 text-center text-[10.5px] font-semibold uppercase leading-none tracking-[0.08em] text-carbon transition-colors hover:bg-carbon hover:text-white"
        >
          Sign In
        </button>
      </SignInButton>

      <SignUpButton mode="modal">
        <button
          type="button"
          onClick={closeMobile}
          className="inline-flex h-10 w-full items-center justify-center whitespace-nowrap bg-carbon px-3 text-center text-[10.5px] font-semibold uppercase leading-none tracking-[0.08em] text-white transition-colors hover:bg-carbon-dark"
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
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Logo + wordmark */}
        <Link
          href="/"
          onClick={closeMobile}
          className="flex min-w-0 shrink-0 items-center gap-3"
        >
          <div className="relative h-12 w-12 overflow-hidden rounded-full border border-neutral-200 bg-paper">
            <Image
              src="/logo.png"
              alt={BRAND}
              fill
              sizes="48px"
              className="object-contain p-1.5"
              priority
            />
          </div>

          <div className="hidden min-w-0 sm:block">
            <p className="truncate font-serif text-xl leading-tight text-carbon">
              {BRAND}
            </p>
            <p className="truncate text-[10px] uppercase tracking-[0.22em] text-neutral-500">
              {TAGLINE}
            </p>
          </div>
        </Link>

        {/* Desktop menu */}
        <nav className="hidden items-center gap-1 lg:flex">
          {navMenu.map((item, navIndex) => (
            <div
              key={item.href}
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
                className="inline-flex h-10 items-center gap-1 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-carbon transition-colors hover:bg-paper"
              >
                {item.label}

                {item.dropdown && (
                  <svg
                    className="h-3 w-3"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </Link>

              {item.dropdown && activeDropdownIndex === navIndex && (
                <div className="absolute left-0 top-full min-w-64 border border-neutral-200 bg-white py-2 shadow-xl">
                  {item.dropdown.map((dropdownItem, index) =>
                    "section" in dropdownItem ? (
                      <p
                        key={`${dropdownItem.section}-${index}`}
                        className="px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400"
                      >
                        {dropdownItem.section}
                      </p>
                    ) : (
                      <Link
                        key={dropdownItem.href}
                        href={dropdownItem.href}
                        className="block px-4 py-2.5 text-sm text-carbon transition-colors hover:bg-paper"
                      >
                        {dropdownItem.label}
                      </Link>
                    ),
                  )}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Right-side actions */}
        <div className="flex shrink-0 items-center justify-end gap-2">
          <div className="hidden md:block">
            <SearchBar />
          </div>

          <DesktopAuthButtons />

          <CartButton />

          {/* Hamburger — mobile only */}
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="flex h-10 w-10 items-center justify-center text-carbon transition-colors hover:bg-paper lg:hidden"
          >
            {mobileOpen ? (
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            ) : (
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 7h16" />
                <path d="M4 12h16" />
                <path d="M4 17h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      {mobileOpen && (
        <div className="border-t border-neutral-200 bg-white px-4 py-5 shadow-lg lg:hidden">
          <div className="mb-5">
            <SearchBar />
          </div>

          <nav className="space-y-1">
            {navMenu.map((item) => (
              <div key={item.href} className="border-b border-neutral-100 pb-2">
                <Link
                  href={item.href}
                  onClick={closeMobile}
                  className="flex items-center justify-between py-3 text-sm font-semibold uppercase tracking-[0.12em] text-carbon"
                >
                  {item.label}
                </Link>

                {item.dropdown && (
                  <div className="space-y-1 pb-2 pl-4">
                    {item.dropdown.map((dropdownItem, index) =>
                      "section" in dropdownItem ? null : (
                        <Link
                          key={`${dropdownItem.href}-${index}`}
                          href={dropdownItem.href}
                          onClick={closeMobile}
                          className="block py-2 text-sm text-neutral-600"
                        >
                          {dropdownItem.label}
                        </Link>
                      ),
                    )}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Auth */}
          <div className="pt-5">
            <MobileAuthButtons closeMobile={closeMobile} />
          </div>
        </div>
      )}
    </header>
  );
}