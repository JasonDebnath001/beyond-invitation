"use client";

import Link from "next/link";
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
      className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-carbon/10 bg-white px-4 text-[13px] font-bold text-carbon shadow-sm transition hover:bg-paper"
    >
      {ready && user ? "My account" : "Sign in"}
    </Link>
  );
}
