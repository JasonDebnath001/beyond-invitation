"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const COOKIE_NAME = "beyond_invitation_cookie_consent";
const COOKIE_VALUE = "accepted";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function getCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const encodedName = `${encodeURIComponent(name)}=`;

  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith(encodedName));

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(cookie.slice(encodedName.length));
}

function saveConsentCookie() {
  const secure =
    window.location.protocol === "https:" ? "; Secure" : "";

  document.cookie = [
    `${encodeURIComponent(COOKIE_NAME)}=${encodeURIComponent(
      COOKIE_VALUE,
    )}`,
    `Max-Age=${COOKIE_MAX_AGE}`,
    "Path=/",
    "SameSite=Lax",
  ].join("; ") + secure;
}

export function hasCookieConsent(): boolean {
  return getCookie(COOKIE_NAME) === COOKIE_VALUE;
}

export default function CookieConsent() {
  const [shouldRender, setShouldRender] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (hasCookieConsent()) {
      return;
    }

    setShouldRender(true);

    const animationFrame = window.requestAnimationFrame(() => {
      setIsOpen(true);
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  function handleAccept() {
    saveConsentCookie();

    window.dispatchEvent(
      new CustomEvent("cookie-consent-change", {
        detail: {
          status: "accepted",
        },
      }),
    );

    setIsOpen(false);

    window.setTimeout(() => {
      setShouldRender(false);
    }, 300);
  }

  if (!shouldRender) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-3 left-3 right-3 z-[100] md:bottom-5 md:left-auto md:right-5 md:w-[430px]">
      <section
        role="dialog"
        aria-live="polite"
        aria-labelledby="cookie-consent-title"
        aria-describedby="cookie-consent-description"
        className={[
          "pointer-events-auto relative overflow-hidden",
          "rounded-[26px] border border-carbon/15",
          "bg-[#fffdf8]/95 backdrop-blur-xl",
          "shadow-[0_18px_60px_rgba(62,12,23,0.16)]",
          "transition-all duration-300 ease-out",
          isOpen
            ? "translate-y-0 opacity-100"
            : "translate-y-4 opacity-0",
        ].join(" ")}
      >
        {/* Subtle invitation-card border */}
        <div
          aria-hidden="true"
          className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent"
        />

        {/* Decorative folded corner */}
        <div
          aria-hidden="true"
          className="absolute right-0 top-0 h-9 w-9 overflow-hidden"
        >
          <div className="absolute right-[-18px] top-[-18px] h-9 w-9 rotate-45 border border-carbon/10 bg-paper" />
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3.5">
            {/* Invitation envelope icon */}
            <div className="relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-carbon/10 bg-paper text-carbon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="h-5 w-5"
              >
                <path
                  d="M4.75 7.25h14.5v10.5H4.75V7.25Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path
                  d="m5.25 8 6.75 5 6.75-5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              <span
                aria-hidden="true"
                className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#fffdf8] bg-carbon"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-gold-light" />
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-carbon/45">
                A small note
              </p>

              <h2
                id="cookie-consent-title"
                className="text-[15px] font-bold leading-tight text-carbon sm:text-base"
              >
                Before you continue browsing
              </h2>

              <p
                id="cookie-consent-description"
                className="mt-1.5 text-[12px] leading-relaxed text-carbon/65 sm:text-[13px]"
              >
                We use cookies and similar storage to keep sign-in,
                cart and checkout reliable, and to remember your
                preferences.
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-carbon/[0.07] pt-3">
            <Link
              href="/privacy-policy"
              className="text-[11px] font-semibold text-carbon/55 underline decoration-carbon/20 underline-offset-4 transition hover:text-carbon"
            >
              Privacy details
            </Link>

            <button
              type="button"
              onClick={handleAccept}
              className="group inline-flex h-9 items-center gap-2 rounded-full bg-carbon px-4 text-[12px] font-bold text-white shadow-[0_6px_18px_rgba(123,28,46,0.18)] transition hover:-translate-y-0.5 hover:bg-carbon-dark hover:shadow-[0_9px_24px_rgba(123,28,46,0.24)] focus:outline-none focus-visible:ring-2 focus-visible:ring-carbon focus-visible:ring-offset-2 active:translate-y-0"
            >
              <span>Accept & continue</span>

              {/* Wax-seal style confirmation */}
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/30 bg-white/10 transition group-hover:rotate-6">
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                  className="h-3 w-3"
                >
                  <path
                    d="m5.5 10 3 3 6-6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}