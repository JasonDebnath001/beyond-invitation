import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/*
 * Clerk middleware.
 *
 * Public browsing is allowed.
 * Account, wishlist, orders, ordering/payment and reseller routes are
 * protected so only signed-in users can access them.
 *
 * IMPORTANT:
 * Do not protect /api/razorpay/webhook because Razorpay calls it server-to-server.
 *
 * Reseller links:
 * Any URL containing ?via=CODE sets an httpOnly cookie and redirects to the
 * same URL without the parameter, so the visitor sees a clean address bar.
 * All server-side pricing reads that cookie.
 */

const RESELLER_URL_PARAM = "via";
const RESELLER_COOKIE = "bi_pref";
const RESELLER_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const CODE_PATTERN = /^[A-Za-z0-9]{4,16}$/;

const isProtectedRoute = createRouteMatcher([
  "/account(.*)",
  "/wishlist(.*)",
  "/my-orders(.*)",
  "/checkout(.*)",
  "/reseller(.*)",
  "/api/reseller(.*)",
  "/api/razorpay/order(.*)",
  "/api/razorpay/verify(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // 1) Capture reseller referral links before anything else.
  const ref = req.nextUrl.searchParams.get(RESELLER_URL_PARAM);

  if (ref && CODE_PATTERN.test(ref)) {
    const cleanUrl = req.nextUrl.clone();
    cleanUrl.searchParams.delete(RESELLER_URL_PARAM);

    const response = NextResponse.redirect(cleanUrl);

    response.cookies.set(RESELLER_COOKIE, ref.toUpperCase(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: RESELLER_COOKIE_MAX_AGE,
    });

    return response;
  }

  // 2) Normal auth protection.
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",

    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};