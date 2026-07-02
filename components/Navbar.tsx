"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

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
    label: "Wedding Cards",
    href: "/wedding-cards",
    dropdown: [
      {
        label: "All Wedding Cards",
        href: "/wedding-cards",
      },
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

function DesktopAuthControls() {
  return (
    <div className="hidden items-center gap-2 lg:flex">
      <Show when="signed-out">
        <SignInButton>
          <button
            type="button"
            className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-carbon transition hover:bg-paper"
          >
            Sign in
          </button>
        </SignInButton>

        <SignUpButton>
          <button
            type="button"
            className="rounded-full bg-carbon px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-carbon-dark"
          >
            Sign up
          </button>
        </SignUpButton>
      </Show>

      <Show when="signed-in">
        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-9 w-9",
            },
          }}
        />
      </Show>
    </div>
  );
}

function MobileAuthControls({ onAction }: { onAction: () => void }) {
  return (
    <div className="grid gap-3 pt-3">
      <Show when="signed-out">
        <SignInButton>
          <button
            type="button"
            onClick={onAction}
            className="flex w-full items-center justify-center rounded-full border border-neutral-300 px-5 py-3 text-sm font-semibold text-carbon transition hover:bg-paper"
          >
            Sign in
          </button>
        </SignInButton>

        <SignUpButton>
          <button
            type="button"
            onClick={onAction}
            className="flex w-full items-center justify-center rounded-full bg-carbon px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-carbon-dark"
          >
            Sign up
          </button>
        </SignUpButton>
      </Show>

      <Show when="signed-in">
        <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3">
          <span className="text-sm font-semibold text-carbon">My account</span>

          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-9 w-9",
              },
            }}
          />
        </div>
      </Show>
    </div>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeDropdownIndex, setActiveDropdownIndex] = useState<number | null>(
    null
  );

  const closeMobile = () => setMobileOpen(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileOpen(false);
        setActiveDropdownIndex(null);
      }
    }

    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setActiveDropdownIndex(null);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <Image
            src="/logo.ico"
            alt={BRAND}
            width={44}
            height={44}
            priority
            className="h-11 w-11 rounded-full object-contain"
          />

          <div className="min-w-0">
            <div className="truncate text-lg font-bold leading-tight text-carbon">
              {BRAND}
            </div>
            <div className="truncate text-xs font-medium uppercase tracking-[0.18em] text-ink-mid">
              {TAGLINE}
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {navMenu.map((item, navIndex) => {
            const hasDropdown = Boolean(item.dropdown?.length);

            return (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() =>
                  hasDropdown && setActiveDropdownIndex(navIndex)
                }
                onMouseLeave={() => setActiveDropdownIndex(null)}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setActiveDropdownIndex(null);
                  }
                }}
              >
                {hasDropdown ? (
                  <button
                    type="button"
                    onClick={() =>
                      setActiveDropdownIndex((current) =>
                        current === navIndex ? null : navIndex
                      )
                    }
                    className="rounded-full px-4 py-2 text-sm font-semibold text-carbon transition hover:bg-paper"
                    aria-haspopup="menu"
                    aria-expanded={activeDropdownIndex === navIndex}
                  >
                    {item.label} <span aria-hidden="true">▾</span>
                  </button>
                ) : item.href ? (
                  <Link
                    href={item.href}
                    className="rounded-full px-4 py-2 text-sm font-semibold text-carbon transition hover:bg-paper"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="rounded-full px-4 py-2 text-sm font-semibold text-carbon">
                    {item.label}
                  </span>
                )}

                {hasDropdown && activeDropdownIndex === navIndex && (
                  <div
                    role="menu"
                    className="absolute left-0 top-full mt-2 w-64 rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl"
                  >
                    {item.dropdown?.map((dropdownItem, index) =>
                      "section" in dropdownItem ? (
                        <div
                          key={`${dropdownItem.section}-${index}`}
                          className="px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-ink-light"
                        >
                          {dropdownItem.section}
                        </div>
                      ) : (
                        <Link
                          key={dropdownItem.href}
                          href={dropdownItem.href}
                          role="menuitem"
                          className="block rounded-xl px-3 py-2 text-sm font-medium text-ink transition hover:bg-paper hover:text-carbon"
                        >
                          {dropdownItem.label}
                        </Link>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <SearchBar />
          <WishlistNavLink />
          <CartButton />
          <DesktopAuthControls />
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          className="flex h-10 w-10 items-center justify-center rounded-full text-2xl leading-none text-carbon transition-colors hover:bg-paper lg:hidden"
        >
          {mobileOpen ? "×" : "☰"}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-neutral-200 bg-white px-4 py-4 shadow-lg lg:hidden">
          <div className="mb-4">
            <SearchBar />
          </div>

          <nav className="space-y-1">
            {navMenu.map((item) => (
              <div key={item.label} className="rounded-2xl bg-paper/70 p-2">
                {item.href ? (
                  <Link
                    href={item.href}
                    onClick={closeMobile}
                    className="block rounded-xl px-3 py-2 text-base font-bold text-carbon transition hover:bg-white"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <div className="rounded-xl px-3 py-2 text-base font-bold text-carbon">
                    {item.label}
                  </div>
                )}

                {item.dropdown && (
                  <div className="mt-1 space-y-1 pl-3">
                    {item.dropdown.map((dropdownItem, index) =>
                      "section" in dropdownItem ? (
                        <div
                          key={`${dropdownItem.section}-${index}`}
                          className="px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-ink-light"
                        >
                          {dropdownItem.section}
                        </div>
                      ) : (
                        <Link
                          key={dropdownItem.href}
                          href={dropdownItem.href}
                          onClick={closeMobile}
                          className="block rounded-xl px-3 py-2 text-sm font-medium text-ink transition hover:bg-white hover:text-carbon"
                        >
                          {dropdownItem.label}
                        </Link>
                      )
                    )}
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="mt-4 grid gap-3 border-t border-neutral-200 pt-4">
            <div className="flex items-center justify-between gap-3">
              <WishlistNavLink />
              <CartButton />
            </div>

            <MobileAuthControls onAction={closeMobile} />
          </div>
        </div>
      )}
    </header>
  );
}