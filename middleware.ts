import { NextResponse, type NextRequest } from "next/server";
import { refreshAuthSession } from "@/lib/supabase/session";

const RESELLER_URL_PARAM = "via";
const RESELLER_COOKIE = "bi_pref";
const RESELLER_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const CODE_PATTERN = /^[A-Za-z0-9]{4,16}$/;

/** Refresh auth cookies before page rendering and preserve referral links. */
export async function middleware(req: NextRequest) {
  const authResponse = await refreshAuthSession(req);
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
