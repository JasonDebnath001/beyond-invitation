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

function isHrefActive(pathname: string, href?: string) {
  if (!href) {
    return false;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function isNavItemActive(pathname: string, item: NavItem) {
  return (
    isHrefActive(pathname, item.href) ||
    item.dropdown?.some(
      (dropdownItem) =>
        "href" in dropdownItem && isHrefActive(pathname, dropdownItem.href)
    ) === true
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className={`h-4 w-4 transition-transform duration-200 motion-reduce:transition-none ${
        open ? "rotate-180" : ""
      }`}
    >
      <path
        d="m5.5 7.5 4.5 4.5 4.5-4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
  const [mobileExpandedIndex, setMobileExpandedIndex] = useState<number | null>(
    null
  );
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
  const mobileToggleRef = useRef<HTMLButtonElement | null>(null);

  const mobileTimelineRef = useRef<ReturnType<typeof gsap.timeline> | null>(
    null
  );

  const hasOpenedMobileMenuRef = useRef(false);

  const closeMobile = (restoreToggleFocus = false) => {
    setMobileOpen(false);

    if (restoreToggleFocus) {
      window.requestAnimationFrame(() => {
        mobileToggleRef.current?.focus();
      });
    }
  };

  const toggleMobile = () => {
    if (mobileOpen) {
      closeMobile();
      return;
    }

    const activeSectionIndex = navMenu.findIndex(
      (item) => item.dropdown?.length && isNavItemActive(pathname, item)
    );

    setMobileExpandedIndex(
      activeSectionIndex >= 0 ? activeSectionIndex : null
    );
    setMobileOpen(true);
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

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

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
        duration: reduceMotion ? 0 : 0.24,
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
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

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

      menu.focus({ preventScroll: true });

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
            duration: reduceMotion ? 0 : 0.3,
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
            duration: reduceMotion ? 0 : 0.5,
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
            duration: reduceMotion ? 0 : 0.38,
            stagger: reduceMotion ? 0 : 0.055,
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
            duration: reduceMotion ? 0 : 0.18,
            stagger: {
              each: reduceMotion ? 0 : 0.025,
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
            duration: reduceMotion ? 0 : 0.36,
            ease: "power3.inOut",
          },
          0.07
        )
        .to(
          backdrop,
          {
            autoAlpha: 0,
            duration: reduceMotion ? 0 : 0.28,
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

  /* Keep keyboard focus inside the open navigation sheet and support Escape. */
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (mobileOpen) {
          closeMobile(true);
        }

        const desktopTrigger =
          activeDropdownIndex === null
            ? null
            : document.getElementById(
                `desktop-nav-trigger-${activeDropdownIndex}`
              );

        setActiveDropdownIndex(null);

        if (desktopTrigger instanceof HTMLButtonElement) {
          window.requestAnimationFrame(() => {
            desktopTrigger.focus();
          });
        }

        return;
      }

      if (event.key !== "Tab" || !mobileOpen || !mobileMenuRef.current) {
        return;
      }

      const menu = mobileMenuRef.current;
      const focusableElements = Array.from(
        menu.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.getClientRects().length > 0);

      if (!focusableElements.length) {
        event.preventDefault();
        menu.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (
        event.shiftKey &&
        (activeElement === firstElement ||
          activeElement === menu ||
          !menu.contains(activeElement))
      ) {
        event.preventDefault();
        lastElement.focus();
      } else if (
        !event.shiftKey &&
        (activeElement === lastElement || !menu.contains(activeElement))
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [activeDropdownIndex, mobileOpen]);

  /*
   * Automatically close the mobile menu when switching to desktop size.
   */
  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1536px)");

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
    setMobileExpandedIndex(null);
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
    <header className="sticky top-0 z-[110] border-b border-carbon/10 bg-white/95 shadow-[0_8px_30px_rgba(123,28,46,0.08)]">
      <div className="relative z-30 mx-auto flex h-16 max-w-[1500px] items-center gap-2 bg-white/95 px-3 backdrop-blur-xl sm:h-[72px] sm:gap-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3 2xl:w-[220px] 2xl:flex-none"
          aria-label={BRAND}
        >
          <Image
            src="/logo.ico"
            alt={BRAND}
            width={42}
            height={42}
            priority
            className="h-9 w-9 shrink-0 rounded-xl object-contain sm:h-10 sm:w-10"
          />

          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold leading-tight tracking-wide text-carbon sm:text-[16px]">
              {BRAND}
            </div>

            <div className="mt-0.5 hidden max-w-[210px] truncate text-[10px] font-bold uppercase tracking-[0.28em] text-ink-mid sm:block">
              {TAGLINE}
            </div>
          </div>
        </Link>

        <nav
          aria-label="Primary navigation"
          className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 2xl:flex"
        >
          {navMenu.map((item, navIndex) => {
            const hasDropdown = Boolean(item.dropdown?.length);

            const isActive = isNavItemActive(pathname, item);

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
                      }
                    }}
                    id={`desktop-nav-trigger-${navIndex}`}
                    className={`inline-flex h-10 items-center gap-1 whitespace-nowrap rounded-full px-3 text-[13px] font-bold transition hover:bg-paper focus:outline-none focus-visible:ring-2 focus-visible:ring-carbon/15 min-[1680px]:px-4 min-[1680px]:text-[14px] ${
                      isActive
                        ? "bg-paper text-carbon"
                        : "text-carbon"
                    }`}
                    aria-expanded={activeDropdownIndex === navIndex}
                    aria-controls={`desktop-dropdown-${navIndex}`}
                  >
                    {item.label}

                    <ChevronIcon
                      open={activeDropdownIndex === navIndex}
                    />
                  </button>
                ) : item.href ? (
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`inline-flex h-10 items-center whitespace-nowrap rounded-full px-3 text-[13px] font-bold transition hover:bg-paper focus:outline-none focus-visible:ring-2 focus-visible:ring-carbon/15 min-[1680px]:px-4 min-[1680px]:text-[14px] ${
                      isActive
                        ? "bg-paper text-carbon"
                        : "text-carbon"
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
                      id={`desktop-dropdown-${navIndex}`}
                      ref={(element) => {
                        desktopDropdownRefs.current[navIndex] = element;
                      }}
                      aria-labelledby={`desktop-nav-trigger-${navIndex}`}
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
                            aria-current={
                              isHrefActive(pathname, dropdownItem.href)
                                ? "page"
                                : undefined
                            }
                            className="block rounded-2xl px-4 py-3 text-sm font-bold text-ink transition hover:bg-paper hover:text-carbon focus:outline-none focus-visible:bg-paper focus-visible:text-carbon focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-carbon/15"
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

        <div className="hidden shrink-0 items-center justify-end gap-2.5 2xl:flex min-[1680px]:gap-3">
          <div className="w-52 min-[1680px]:w-60">
            <SearchBar />
          </div>

          <WishlistNavLink />
          <CartButton />
          <DesktopAuthControls />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 2xl:hidden">
          <CartButton />

          <button
            ref={mobileToggleRef}
            type="button"
            onClick={toggleMobile}
            aria-label={
              mobileOpen ? "Close navigation menu" : "Open navigation menu"
            }
            aria-haspopup="dialog"
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-carbon/10 bg-white text-carbon shadow-sm transition hover:border-carbon/25 hover:bg-paper focus:outline-none focus-visible:ring-2 focus-visible:ring-carbon/20"
          >
            <span className="relative block h-5 w-5" aria-hidden="true">
              <span
                className={`absolute left-0 top-[2px] h-0.5 w-5 rounded-full bg-current transition-all duration-300 ease-out motion-reduce:transition-none ${
                  mobileOpen
                    ? "translate-y-[7px] rotate-45"
                    : "translate-y-0 rotate-0"
                }`}
              />

              <span
                className={`absolute left-0 top-[9px] h-0.5 w-5 rounded-full bg-current transition-all duration-200 ease-out motion-reduce:transition-none ${
                  mobileOpen
                    ? "scale-x-0 opacity-0"
                    : "scale-x-100 opacity-100"
                }`}
              />

              <span
                className={`absolute left-0 top-[16px] h-0.5 w-5 rounded-full bg-current transition-all duration-300 ease-out motion-reduce:transition-none ${
                  mobileOpen
                    ? "-translate-y-[7px] -rotate-45"
                    : "translate-y-0 rotate-0"
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      <button
        ref={mobileBackdropRef}
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => closeMobile(true)}
        className="fixed inset-x-0 bottom-0 top-16 z-0 bg-carbon/20 backdrop-blur-[2px] sm:top-[72px] 2xl:hidden"
        style={{
          opacity: 0,
          visibility: "hidden",
          pointerEvents: "none",
        }}
      />

      <div
        id="mobile-navigation"
        ref={mobileMenuRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        aria-hidden={!mobileOpen}
        tabIndex={-1}
        className="fixed inset-x-0 top-16 z-20 overflow-hidden border-t border-carbon/10 bg-white shadow-[0_18px_40px_rgba(42,26,16,0.16)] outline-none sm:inset-x-auto sm:right-6 sm:top-20 sm:w-[28rem] sm:rounded-[1.75rem] sm:border lg:right-8 2xl:hidden"
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
          className="max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain sm:max-h-[calc(100dvh-6rem)]"
        >
          <div className="px-4 py-4 sm:p-5">
            <div data-mobile-menu-item className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <SearchBar onNavigate={() => closeMobile()} />
              </div>

              <button
                type="button"
                onClick={() => closeMobile(true)}
                aria-label="Close navigation menu"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-carbon/10 bg-white text-carbon shadow-sm transition hover:border-carbon/25 hover:bg-paper focus:outline-none focus-visible:ring-2 focus-visible:ring-carbon/20"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  className="h-5 w-5"
                >
                  <path
                    d="m5 5 10 10M15 5 5 15"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <nav aria-label="Mobile navigation" className="mt-4 space-y-2">
              {navMenu.map((item, navIndex) => {
                const hasDropdown = Boolean(item.dropdown?.length);
                const isExpanded = mobileExpandedIndex === navIndex;
                const isActive = isNavItemActive(pathname, item);
                const nestedItems = item.dropdown?.filter(
                  (dropdownItem) =>
                    "section" in dropdownItem ||
                    dropdownItem.href !== item.href
                );

                return (
                  <div
                    key={item.label}
                    data-mobile-menu-item
                    className={`rounded-2xl border p-1.5 transition-colors ${
                      isActive
                        ? "border-carbon/20 bg-paper"
                        : "border-carbon/10 bg-paper/60"
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      {item.href ? (
                        <Link
                          href={item.href}
                          onClick={() => closeMobile()}
                          aria-current={
                            isHrefActive(pathname, item.href)
                              ? "page"
                              : undefined
                          }
                          className="min-w-0 flex-1 rounded-xl px-3 py-2.5 text-[15px] font-extrabold text-carbon transition hover:bg-white focus:outline-none focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-carbon/15"
                        >
                          {item.label}
                        </Link>
                      ) : (
                        <div className="min-w-0 flex-1 rounded-xl px-3 py-2.5 text-[15px] font-extrabold text-carbon">
                          {item.label}
                        </div>
                      )}

                      {hasDropdown && (
                        <button
                          type="button"
                          onClick={() => {
                            setMobileExpandedIndex((current) =>
                              current === navIndex ? null : navIndex
                            );
                          }}
                          aria-label={`${
                            isExpanded ? "Collapse" : "Expand"
                          } ${item.label}`}
                          aria-expanded={isExpanded}
                          aria-controls={`mobile-nav-section-${navIndex}`}
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-carbon transition hover:bg-white focus:outline-none focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-carbon/15"
                        >
                          <ChevronIcon open={isExpanded} />
                        </button>
                      )}
                    </div>

                    {hasDropdown && isExpanded && (
                      <div
                        id={`mobile-nav-section-${navIndex}`}
                        className="mt-1 space-y-1 border-t border-carbon/10 px-1 pt-1"
                      >
                        {nestedItems?.map((dropdownItem, index) =>
                          "section" in dropdownItem ? (
                            <div
                              key={`${dropdownItem.section}-${index}`}
                              className="px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-ink-light"
                            >
                              {dropdownItem.section}
                            </div>
                          ) : (
                            <Link
                              key={dropdownItem.href}
                              href={dropdownItem.href}
                              onClick={() => closeMobile()}
                              aria-current={
                                isHrefActive(pathname, dropdownItem.href)
                                  ? "page"
                                  : undefined
                              }
                              className={`block rounded-xl px-3 py-2.5 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-carbon/15 ${
                                isHrefActive(pathname, dropdownItem.href)
                                  ? "bg-white text-carbon"
                                  : "text-ink hover:bg-white hover:text-carbon"
                              }`}
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

            <div
              data-mobile-menu-item
              className="mt-5 border-t border-carbon/10 pt-5"
            >
              <div className="grid grid-cols-2 gap-3">
                <WishlistNavLink
                  showLabel
                  onNavigate={() => closeMobile()}
                />
                <CartButton showLabel onNavigate={() => closeMobile()} />
              </div>

              <MobileAuthControls onAction={() => closeMobile()} />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
