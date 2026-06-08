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
    return <div className="h-9 w-24 rounded-full bg-carbon/5" />;
  }

  if (isSignedIn) {
    return (
      <UserButton
        appearance={{
          elements: {
            avatarBox: "h-9 w-9",
          },
        }}
      />
    );
  }

  return (
    <>
      <SignInButton mode="modal">
        <button
          type="button"
          className="rounded-full border border-carbon/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-carbon transition-colors hover:bg-paper"
        >
          Sign In
        </button>
      </SignInButton>

      <SignUpButton mode="modal">
        <button
          type="button"
          className="rounded-full bg-carbon px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-carbon/85"
        >
          Sign Up
        </button>
      </SignUpButton>
    </>
  );
}

function MobileAuthButtons({ closeMobile }: { closeMobile: () => void }) {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return <div className="h-10 w-full rounded-full bg-carbon/5" />;
  }

  if (isSignedIn) {
    return (
      <>
        <Link
          href="/account"
          onClick={closeMobile}
          className="flex-1 rounded-full border border-carbon/15 px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-[0.16em] text-carbon"
        >
          Account
        </Link>

        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-10 w-10",
            },
          }}
        />
      </>
    );
  }

  return (
    <>
      <SignInButton mode="modal">
        <button
          type="button"
          className="flex-1 rounded-full border border-carbon/15 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-carbon"
        >
          Sign In
        </button>
      </SignInButton>

      <SignUpButton mode="modal">
        <button
          type="button"
          className="flex-1 rounded-full bg-carbon px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-white"
        >
          Sign Up
        </button>
      </SignUpButton>
    </>
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
    <header className="sticky top-0 z-50 border-b border-carbon/10 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo + wordmark */}
        <Link
          href="/"
          className="flex min-w-0 items-center gap-3 py-4"
          onClick={closeMobile}
        >
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

          <div className="hidden min-w-0 flex-col sm:flex">
            <span className="truncate text-sm font-semibold uppercase tracking-[0.24em] text-carbon">
              {BRAND}
            </span>
            <span className="truncate text-[11px] uppercase tracking-[0.22em] text-carbon/55">
              {TAGLINE}
            </span>
          </div>
        </Link>

        {/* Desktop menu */}
        <nav className="hidden items-center gap-7 lg:flex">
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
                aria-haspopup={item.dropdown ? "menu" : undefined}
                aria-expanded={
                  item.dropdown ? activeDropdownIndex === navIndex : undefined
                }
                className="flex items-center gap-1.5 py-6 text-[11.5px] font-medium uppercase tracking-[0.16em] text-carbon transition-colors hover:text-carbon/70"
              >
                {item.label}

                {item.dropdown && (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className="h-3.5 w-3.5"
                  >
                    <path
                      d="M5.5 7.5L10 12l4.5-4.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </Link>

              {item.dropdown && activeDropdownIndex === navIndex && (
                <div
                  role="menu"
                  className="absolute left-0 top-full w-64 border border-carbon/10 bg-white p-2 shadow-xl"
                >
                  {item.dropdown.map((dropdownItem, index) =>
                    "section" in dropdownItem ? (
                      <div
                        key={`${dropdownItem.section}-${index}`}
                        className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-carbon/45"
                      >
                        {dropdownItem.section}
                      </div>
                    ) : (
                      <Link
                        key={dropdownItem.href}
                        href={dropdownItem.href}
                        role="menuitem"
                        className="block px-3 py-2.5 text-sm text-carbon transition-colors hover:bg-paper"
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
        <div className="flex items-center gap-3">
          <div className="hidden xl:block">
            <SearchBar />
          </div>

          <CartButton />

          <div className="hidden items-center gap-2 lg:flex">
            <DesktopAuthButtons />
          </div>

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
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-6 w-6"
              >
                <path
                  d="M6 6l12 12M18 6L6 18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-6 w-6"
              >
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      {mobileOpen && (
        <div className="border-t border-carbon/10 bg-white px-4 py-5 shadow-lg lg:hidden">
          <div className="mb-5">
            <SearchBar />
          </div>

          <nav className="space-y-1">
            {navMenu.map((item) => (
              <div key={item.href} className="border-b border-carbon/10 py-2">
                <Link
                  href={item.href}
                  onClick={closeMobile}
                  className="block py-2 text-sm font-semibold uppercase tracking-[0.18em] text-carbon"
                >
                  {item.label}
                </Link>

                {item.dropdown && (
                  <div className="pb-2 pl-4">
                    {item.dropdown.map((dropdownItem, index) =>
                      "section" in dropdownItem ? null : (
                        <Link
                          key={`${dropdownItem.href}-${index}`}
                          href={dropdownItem.href}
                          onClick={closeMobile}
                          className="block py-1.5 text-sm text-carbon/70"
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

          <div className="mt-5 flex items-center gap-3">
            <MobileAuthButtons closeMobile={closeMobile} />
          </div>
        </div>
      )}
    </header>
  );
}