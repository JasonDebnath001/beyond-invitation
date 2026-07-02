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
    <div className="flex shrink-0 items-center gap-2">
      <Show when="signed-out">
        <SignInButton>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-full border border-carbon/20 bg-white px-4 text-[13px] font-bold text-carbon shadow-sm transition hover:border-carbon/40 hover:bg-paper focus:outline-none focus:ring-2 focus:ring-carbon/15"
          >
            Sign in
          </button>
        </SignInButton>

        <SignUpButton>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-full bg-carbon px-5 text-[13px] font-bold text-white shadow-sm transition hover:bg-carbon-dark focus:outline-none focus:ring-2 focus:ring-carbon/25"
          >
            Sign up
          </button>
        </SignUpButton>
      </Show>

      <Show when="signed-in">
        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-10 w-10",
            },
          }}
        />
      </Show>
    </div>
  );
}

function MobileAuthControls({ onAction }: { onAction: () => void }) {
  return (
    <div className="pt-4">
      <Show when="signed-out">
        <div className="grid grid-cols-2 gap-3">
          <SignInButton>
            <button
              type="button"
              onClick={onAction}
              className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-full border border-carbon/20 bg-white px-4 text-sm font-bold text-carbon shadow-sm transition hover:bg-paper"
            >
              Sign in
            </button>
          </SignInButton>

          <SignUpButton>
            <button
              type="button"
              onClick={onAction}
              className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-full bg-carbon px-4 text-sm font-bold text-white shadow-sm transition hover:bg-carbon-dark"
            >
              Sign up
            </button>
          </SignUpButton>
        </div>
      </Show>

      <Show when="signed-in">
        <div className="flex items-center justify-between rounded-2xl border border-carbon/10 bg-white px-4 py-3 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-light">
              Signed in
            </p>
            <p className="text-sm font-bold text-carbon">My account</p>
          </div>

          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-10 w-10",
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
    <header className="sticky top-0 z-50 border-b border-carbon/10 bg-white/95 shadow-[0_8px_30px_rgba(123,28,46,0.08)] backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1500px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex min-w-0 shrink-0 items-center gap-3 xl:w-[260px]"
          aria-label={BRAND}
        >
          <Image
            src="/logo.ico"
            alt={BRAND}
            width={42}
            height={42}
            priority
            className="h-10 w-10 shrink-0 rounded-xl object-contain"
          />

          <div className="min-w-0">
            <div className="truncate text-[16px] font-extrabold leading-tight tracking-wide text-carbon">
              {BRAND}
            </div>
            <div className="mt-0.5 hidden max-w-[210px] truncate text-[10px] font-bold uppercase tracking-[0.28em] text-ink-mid sm:block">
              {TAGLINE}
            </div>
          </div>
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-1 xl:flex">
          {navMenu.map((item, navIndex) => {
            const hasDropdown = Boolean(item.dropdown?.length);
            const isActive =
              Boolean(item.href) &&
              (pathname === item.href || pathname.startsWith(`${item.href}/`));

            return (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() =>
                  hasDropdown && setActiveDropdownIndex(navIndex)
                }
                onMouseLeave={() => setActiveDropdownIndex(null)}
                onBlur={(event) => {
                  const nextTarget = event.relatedTarget as Node | null;

                  if (
                    nextTarget &&
                    !event.currentTarget.contains(nextTarget)
                  ) {
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
                    className={`inline-flex h-10 items-center gap-1 whitespace-nowrap rounded-full px-4 text-[14px] font-bold transition ${
                      isActive
                        ? "bg-paper text-carbon"
                        : "text-carbon hover:bg-paper"
                    }`}
                    aria-haspopup="menu"
                    aria-expanded={activeDropdownIndex === navIndex}
                  >
                    {item.label}
                    <span
                      aria-hidden="true"
                      className={`text-[11px] transition-transform ${
                        activeDropdownIndex === navIndex ? "rotate-180" : ""
                      }`}
                    >
                      ▼
                    </span>
                  </button>
                ) : item.href ? (
                  <Link
                    href={item.href}
                    className={`inline-flex h-10 items-center whitespace-nowrap rounded-full px-4 text-[14px] font-bold transition ${
                      isActive
                        ? "bg-paper text-carbon"
                        : "text-carbon hover:bg-paper"
                    }`}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="inline-flex h-10 items-center whitespace-nowrap rounded-full px-4 text-[14px] font-bold text-carbon">
                    {item.label}
                  </span>
                )}

                {hasDropdown && activeDropdownIndex === navIndex && (
                  <div
                    role="menu"
                    className="absolute left-0 top-full mt-3 w-72 rounded-3xl border border-carbon/10 bg-white p-2 shadow-[0_20px_50px_rgba(42,26,16,0.16)]"
                  >
                    {item.dropdown?.map((dropdownItem, index) =>
                      "section" in dropdownItem ? (
                        <div
                          key={`${dropdownItem.section}-${index}`}
                          className="px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-ink-light"
                        >
                          {dropdownItem.section}
                        </div>
                      ) : (
                        <Link
                          key={dropdownItem.href}
                          href={dropdownItem.href}
                          role="menuitem"
                          className="block rounded-2xl px-4 py-3 text-sm font-bold text-ink transition hover:bg-paper hover:text-carbon"
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

        <div className="hidden shrink-0 items-center justify-end gap-3 xl:flex">
          <div className="w-[230px] 2xl:w-[280px]">
            <SearchBar />
          </div>

          <WishlistNavLink />
          <CartButton />
          <DesktopAuthControls />
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          className="ml-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-carbon/10 bg-white text-2xl font-bold leading-none text-carbon shadow-sm transition hover:bg-paper xl:hidden"
        >
          {mobileOpen ? "×" : "☰"}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-carbon/10 bg-white shadow-[0_18px_40px_rgba(42,26,16,0.14)] xl:hidden">
          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
            <SearchBar />

            <nav className="mt-5 space-y-2">
              {navMenu.map((item) => (
                <div
                  key={item.label}
                  className="rounded-3xl border border-carbon/10 bg-paper/70 p-2"
                >
                  {item.href ? (
                    <Link
                      href={item.href}
                      onClick={closeMobile}
                      className="block rounded-2xl px-4 py-3 text-base font-extrabold text-carbon transition hover:bg-white"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <div className="rounded-2xl px-4 py-3 text-base font-extrabold text-carbon">
                      {item.label}
                    </div>
                  )}

                  {item.dropdown && (
                    <div className="mt-1 space-y-1 pl-2">
                      {item.dropdown.map((dropdownItem, index) =>
                        "section" in dropdownItem ? (
                          <div
                            key={`${dropdownItem.section}-${index}`}
                            className="px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-ink-light"
                          >
                            {dropdownItem.section}
                          </div>
                        ) : (
                          <Link
                            key={dropdownItem.href}
                            href={dropdownItem.href}
                            onClick={closeMobile}
                            className="block rounded-2xl px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-white hover:text-carbon"
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

            <div className="mt-5 border-t border-carbon/10 pt-5">
              <div className="flex items-center gap-3">
                <WishlistNavLink />
                <CartButton />
              </div>

              <MobileAuthControls onAction={closeMobile} />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}