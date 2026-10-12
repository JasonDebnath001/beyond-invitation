import { NextResponse, type NextRequest } from "next/server";
import { refreshAuthSession } from "@/lib/supabase/session";

const RESELLER_URL_PARAM = "via";
const RESELLER_COOKIE = "bi_pref";
const RESELLER_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const CODE_PATTERN = /^[A-Za-z0-9]{4,16}$/;

// These pages read public catalogue/content data, never an authenticated user
// during SSR. The browser maintains their session; account/auth routes still
// refresh here and private pages/APIs verify identity with getUser themselves.
// Keep this an explicit allowlist so new routes retain session refresh by default.
const PUBLIC_DOCUMENT_PATHS = new Set([
  "/", "/catalog", "/wedding-cards", "/wedding-boxes", "/search",
  "/about", "/contact", "/visit-us", "/blog", "/blogs",
  "/wedding-card-hindu", "/wedding-card-muslim", "/wedding-card-christian",
  "/privacy-policy", "/refund-policy", "/shipping-policy", "/terms-and-conditions",
]);

function isPublicDocument(pathname: string) {
  const path = pathname.replace(/\/$/, "") || "/";
  return PUBLIC_DOCUMENT_PATHS.has(path) || /^\/(?:products|collections|blog)\/[^/]+$/.test(path);
}

/** Refresh auth when required for SSR and preserve referral links everywhere. */
export async function middleware(req: NextRequest) {
  const authResponse = isPublicDocument(req.nextUrl.pathname)
    ? NextResponse.next({ request: req })
    : await refreshAuthSession(req);
  const ref = req.nextUrl.searchParams.get(RESELLER_URL_PARAM);
  if (ref && CODE_PATTERN.test(ref)) {
    const cleanUrl = req.nextUrl.clone();
    cleanUrl.searchParams.delete(RESELLER_URL_PARAM);
    const response = NextResponse.redirect(cleanUrl);
    authResponse.cookies
      .getAll()
      .forEach((cookie) => response.cookies.set(cookie));
    for (const name of ["cache-control", "expires", "pragma"]) {
      const value = authResponse.headers.get(name);
      if (value) response.headers.set(name, value);
    }
    response.cookies.set(RESELLER_COOKIE, ref.toUpperCase(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: RESELLER_COOKIE_MAX_AGE,
    });
    return response;
  }
  return authResponse;
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
