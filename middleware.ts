import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/*
 * Clerk middleware.
 * By default every route is public. createRouteMatcher defines which
 * routes require a signed-in user — here, anything under /account.
 * Add more patterns to the array to protect additional routes.
 */
const isProtectedRoute = createRouteMatcher(["/account(.*)"]);

export default clerkMiddleware(async (auth, req) => {
    if (isProtectedRoute(req)) {
        // Redirects unauthenticated users to the sign-in flow.
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