"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import gsap from "gsap";
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
      {
        label: "Wedding Box",
        href: "/wedding-boxes",
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

  const desktopCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const desktopDropdownRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileBackdropRef = useRef<HTMLButtonElement | null>(null);
  const mobileMenuContentRef = useRef<HTMLDivElement | null>(null);

  const mobileTimelineRef = useRef<ReturnType<typeof gsap.timeline> | null>(
    null
  );

  const hasOpenedMobileMenuRef = useRef(false);

  const closeMobile = () => {
    setMobileOpen(false);
  };

  const cancelDesktopClose = () => {
    if (!desktopCloseTimerRef.current) {
      return;
    }

    clearTimeout(desktopCloseTimerRef.current);
    desktopCloseTimerRef.current = null;
  };

  const openDesktopDropdown = (index: number) => {
    cancelDesktopClose();
    setActiveDropdownIndex(index);
  };

  const scheduleDesktopClose = () => {
    cancelDesktopClose();

    desktopCloseTimerRef.current = setTimeout(() => {
      setActiveDropdownIndex(null);
      desktopCloseTimerRef.current = null;
    }, 180);
  };

  /*
   * Animate the desktop dropdown whenever a new dropdown is opened.
   */
  useEffect(() => {
    if (activeDropdownIndex === null) {
      return;
    }

    const dropdown = desktopDropdownRefs.current[activeDropdownIndex];

    if (!dropdown) {
      return;
    }

    gsap.killTweensOf(dropdown);

    gsap.fromTo(
      dropdown,
      {
        autoAlpha: 0,
        y: 8,
        scale: 0.985,
        transformOrigin: "top left",
      },
      {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: 0.24,
        ease: "power3.out",
      }
    );
  }, [activeDropdownIndex]);

  /*
   * Animate the mobile menu in both directions.
   *
   * The menu remains mounted while closing, allowing GSAP to finish the
   * closing animation before it becomes invisible and non-interactive.
   */
  useEffect(() => {
    const menu = mobileMenuRef.current;
    const backdrop = mobileBackdropRef.current;
    const content = mobileMenuContentRef.current;

    if (!menu || !backdrop || !content) {
      return;
    }

    const animatedItems = Array.from(
      content.querySelectorAll<HTMLElement>("[data-mobile-menu-item]")
    );

    mobileTimelineRef.current?.kill();

    if (mobileOpen) {
      hasOpenedMobileMenuRef.current = true;

      gsap.killTweensOf([menu, backdrop, ...animatedItems]);

      gsap.set(backdrop, {
        visibility: "visible",
        pointerEvents: "auto",
      });

      gsap.set(menu, {
        visibility: "visible",
        pointerEvents: "auto",
      });

      const timeline = gsap.timeline();

      mobileTimelineRef.current = timeline;

      timeline
        .fromTo(
          backdrop,
          {
            autoAlpha: 0,
          },
          {
            autoAlpha: 1,
            duration: 0.3,
            ease: "power2.out",
          },
          0
        )
        .fromTo(
          menu,
          {
            height: 0,
            autoAlpha: 0,
            y: -16,
          },
          {
            height: "auto",
            autoAlpha: 1,
            y: 0,
            duration: 0.5,
            ease: "power4.out",
          },
          0
        )
        .fromTo(
          animatedItems,
          {
            autoAlpha: 0,
            y: -14,
            scale: 0.985,
          },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.38,
            stagger: 0.055,
            ease: "power3.out",
          },
          0.12
        )
        .set(menu, {
          height: "auto",
        });
    } else {
      /*
       * Prevent a closing animation from running during the initial render.
       */
      if (!hasOpenedMobileMenuRef.current) {
        gsap.set(menu, {
          height: 0,
          autoAlpha: 0,
          y: -12,
          visibility: "hidden",
          pointerEvents: "none",
        });

        gsap.set(backdrop, {
          autoAlpha: 0,
          visibility: "hidden",
          pointerEvents: "none",
        });

        gsap.set(animatedItems, {
          autoAlpha: 0,
          y: -10,
          scale: 0.985,
        });

        return;
      }

      gsap.killTweensOf([menu, backdrop, ...animatedItems]);

      const timeline = gsap.timeline({
        onComplete: () => {
          gsap.set(menu, {
            height: 0,
            autoAlpha: 0,
            y: -12,
            visibility: "hidden",
            pointerEvents: "none",
          });

          gsap.set(backdrop, {
            autoAlpha: 0,
            visibility: "hidden",
            pointerEvents: "none",
          });

          gsap.set(animatedItems, {
            autoAlpha: 0,
            y: -10,
            scale: 0.985,
          });
        },
      });

      mobileTimelineRef.current = timeline;

      timeline
        .to(
          animatedItems,
          {
            autoAlpha: 0,
            y: -10,
            scale: 0.985,
            duration: 0.18,
            stagger: {
              each: 0.025,
              from: "end",
            },
            ease: "power2.in",
          },
          0
        )
        .to(
          menu,
          {
            height: 0,
            autoAlpha: 0,
            y: -12,
            duration: 0.36,
            ease: "power3.inOut",
          },
          0.07
        )
        .to(
          backdrop,
          {
            autoAlpha: 0,
            duration: 0.28,
            ease: "power2.in",
          },
          0.07
        );
    }

    return () => {
      mobileTimelineRef.current?.kill();
    };
  }, [mobileOpen]);

  /*
   * Prevent the page behind the mobile navigation from scrolling.
   */
  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  /*
   * Close menus with the Escape key.
   */
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      setMobileOpen(false);
      setActiveDropdownIndex(null);
    }

    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  /*
   * Automatically close the mobile menu when switching to desktop size.
   */
  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1280px)");

    const handleDesktopViewport = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setMobileOpen(false);
      }
    };

    mediaQuery.addEventListener("change", handleDesktopViewport);

    return () => {
      mediaQuery.removeEventListener("change", handleDesktopViewport);
    };
  }, []);

  /*
   * Close menus after navigating to another route.
   */
  useEffect(() => {
    setMobileOpen(false);
    setActiveDropdownIndex(null);
  }, [pathname]);

  /*
   * Clear pending timers and GSAP animations on unmount.
   */
  useEffect(() => {
    return () => {
      cancelDesktopClose();
      mobileTimelineRef.current?.kill();
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-carbon/10 bg-white/95 shadow-[0_8px_30px_rgba(123,28,46,0.08)] backdrop-blur-xl">
      <div className="relative z-30 mx-auto flex h-[72px] max-w-[1500px] items-center gap-4 bg-white/95 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
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
              (pathname === item.href ||
                pathname.startsWith(`${item.href}/`));

            return (
              <div
                key={item.label}
                className="relative py-3"
                onMouseEnter={() => {
                  if (hasDropdown) {
                    openDesktopDropdown(navIndex);
                  }
                }}
                onMouseLeave={scheduleDesktopClose}
                onFocus={() => {
                  if (hasDropdown) {
                    openDesktopDropdown(navIndex);
                  }
                }}
                onBlur={(event) => {
                  const nextTarget = event.relatedTarget as Node | null;

                  if (
                    nextTarget &&
                    event.currentTarget.contains(nextTarget)
                  ) {
                    return;
                  }

                  scheduleDesktopClose();
                }}
              >
                {hasDropdown ? (
                  <button
                    type="button"
                    onClick={() => {
                      cancelDesktopClose();

                      setActiveDropdownIndex((current) =>
                        current === navIndex ? null : navIndex
                      );
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setActiveDropdownIndex(null);
                        event.currentTarget.blur();
                      }
                    }}
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
                      className={`text-[11px] transition-transform duration-200 ${
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
                  /*
                   * The outer padding creates a transparent hover bridge
                   * between the trigger and the visible dropdown.
                   */
                  <div className="absolute left-0 top-full z-50 pt-2">
                    <div
                      ref={(element) => {
                        desktopDropdownRefs.current[navIndex] = element;
                      }}
                      role="menu"
                      onMouseEnter={cancelDesktopClose}
                      onMouseLeave={scheduleDesktopClose}
                      className="w-72 rounded-3xl border border-carbon/10 bg-white p-2 shadow-[0_20px_50px_rgba(42,26,16,0.16)]"
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
                            className="block rounded-2xl px-4 py-3 text-sm font-bold text-ink transition hover:bg-paper hover:text-carbon focus:bg-paper focus:text-carbon focus:outline-none"
                          >
                            {dropdownItem.label}
                          </Link>
                        )
                      )}
                    </div>
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
          onClick={() => {
            setMobileOpen((open) => !open);
          }}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation"
          className="ml-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-carbon/10 bg-white text-carbon shadow-sm transition hover:bg-paper focus:outline-none focus:ring-2 focus:ring-carbon/15 xl:hidden"
        >
          <span className="relative block h-5 w-5" aria-hidden="true">
            <span
              className={`absolute left-0 top-[2px] h-0.5 w-5 rounded-full bg-current transition-all duration-300 ease-out ${
                mobileOpen
                  ? "translate-y-[7px] rotate-45"
                  : "translate-y-0 rotate-0"
              }`}
            />

            <span
              className={`absolute left-0 top-[9px] h-0.5 w-5 rounded-full bg-current transition-all duration-200 ease-out ${
                mobileOpen ? "scale-x-0 opacity-0" : "scale-x-100 opacity-100"
              }`}
            />

            <span
              className={`absolute left-0 top-[16px] h-0.5 w-5 rounded-full bg-current transition-all duration-300 ease-out ${
                mobileOpen
                  ? "-translate-y-[7px] -rotate-45"
                  : "translate-y-0 rotate-0"
              }`}
            />
          </span>
        </button>
      </div>

      <button
        ref={mobileBackdropRef}
        type="button"
        tabIndex={mobileOpen ? 0 : -1}
        aria-label="Close mobile menu"
        onClick={closeMobile}
        className="fixed inset-x-0 bottom-0 top-[72px] z-0 bg-carbon/20 backdrop-blur-[2px] xl:hidden"
        style={{
          opacity: 0,
          visibility: "hidden",
          pointerEvents: "none",
        }}
      />

      <div
        id="mobile-navigation"
        ref={mobileMenuRef}
        aria-hidden={!mobileOpen}
        className="relative z-20 overflow-hidden border-t border-carbon/10 bg-white shadow-[0_18px_40px_rgba(42,26,16,0.14)] xl:hidden"
        style={{
          height: 0,
          opacity: 0,
          visibility: "hidden",
          pointerEvents: "none",
          transform: "translateY(-12px)",
        }}
      >
        <div
          ref={mobileMenuContentRef}
          className="max-h-[calc(100dvh-72px)] overflow-y-auto overscroll-contain"
        >
          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
            <div data-mobile-menu-item>
              <SearchBar />
            </div>

            <nav className="mt-5 space-y-2">
              {navMenu.map((item) => (
                <div
                  key={item.label}
                  data-mobile-menu-item
                  className="rounded-3xl border border-carbon/10 bg-paper/70 p-2 shadow-sm"
                >
                  {item.href ? (
                    <Link
                      href={item.href}
                      onClick={closeMobile}
                      className="block rounded-2xl px-4 py-3 text-base font-extrabold text-carbon transition hover:bg-white focus:bg-white focus:outline-none"
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
                            className="block rounded-2xl px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-white hover:text-carbon focus:bg-white focus:text-carbon focus:outline-none"
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

            <div
              data-mobile-menu-item
              className="mt-5 border-t border-carbon/10 pt-5"
            >
              <div className="flex items-center gap-3">
                <WishlistNavLink />
                <CartButton />
              </div>

              <MobileAuthControls onAction={closeMobile} />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}