"use client";

import NextLink, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
import { createPortal } from "react-dom";

/** Native router state, visible even after a mobile menu closes. */
export function NavigationFeedback({ pending }: { pending: boolean }) {
  if (!pending || typeof document === "undefined") return null;
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-3 rounded-full border border-gold/25 bg-white px-5 py-3 text-sm font-semibold text-carbon shadow-lg"
    >
      <span
        aria-hidden="true"
        className="h-4 w-4 rounded-full border-2 border-carbon/20 border-t-carbon motion-safe:animate-spin"
      />
      Opening page…
    </div>,
    document.body,
  );
}

function LinkFeedback() {
  const { pending } = useLinkStatus();
  return <NavigationFeedback pending={pending} />;
}

export default function NavigationLink({
  children,
  ...props
}: ComponentProps<typeof NextLink>) {
  return (
    <NextLink {...props}>
      {children}
      <LinkFeedback />
    </NextLink>
  );
}
