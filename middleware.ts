import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/*
 * Clerk middleware.
 *
 * Public browsing is allowed.
 * Ordering/payment routes are protected so only signed-in users can place orders.
 *
 * IMPORTANT:
 * Do not protect /api/razorpay/webhook because Razorpay calls it server-to-server.
 */
const isProtectedRoute = createRouteMatcher([
  "/account(.*)",
  "/checkout(.*)",
  "/api/razorpay/order(.*)",
  "/api/razorpay/verify(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
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