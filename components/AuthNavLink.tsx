"use client";

import Link from "@/components/NavigationLink";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { safeAuthRedirect } from "@/lib/auth";

export default function AuthNavLink({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const { user, ready } = useAuth();
  const pathname = usePathname();
  const href = user
    ? "/account"
    : `/sign-in?next=${encodeURIComponent(safeAuthRedirect(pathname))}`;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-label={user ? "My account" : "Sign in"}
      className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-carbon/10 bg-white px-4 py-2 text-base font-bold text-carbon shadow-sm transition hover:bg-paper"
    >
      {ready && user ? "My account" : "Sign in"}
    </Link>
  );
}
