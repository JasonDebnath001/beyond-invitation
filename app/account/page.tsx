import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";

export const metadata: Metadata = {
    title: "My Account – Beyond Invitation",
    robots: {
        index: false,
        follow: false,
    },
};

/**
 * Account page — protected by middleware.ts, so only signed-in users
 * reach it. Unauthenticated visitors are redirected to sign in.
 * Reads the signed-in user with currentUser() on the server.
 */
export default async function AccountPage() {
    const user = await currentUser();

    // Middleware already guards this route; this is a defensive fallback.
    if (!user) return null;

    const fullName =
        [user.firstName, user.lastName].filter(Boolean).join(" ") || "there";
    const email = user.emailAddresses[0]?.emailAddress ?? "—";
    const joined = new Date(user.createdAt).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    return (
        <div className="mx-auto min-w-0 max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-gold">
                My Account
            </p>
            <h1 className="mt-1 break-words font-display text-2xl font-semibold text-maroon-dark sm:text-3xl">
                Welcome, {fullName}
            </h1>

            <div className="mt-8 min-w-0 rounded-xl border border-gold/25 bg-white p-4 sm:p-6">
                <h2 className="mb-4 font-display text-xl font-semibold text-maroon-dark">
                    Profile Details
                </h2>
                <dl className="space-y-3 text-[14px]">
                    <div className="flex min-w-0 flex-col gap-1 min-[420px]:flex-row min-[420px]:gap-4">
                        <dt className="text-ink-light min-[420px]:w-32 min-[420px]:shrink-0">Name</dt>
                        <dd className="min-w-0 break-words text-ink">{fullName}</dd>
                    </div>
                    <div className="flex min-w-0 flex-col gap-1 min-[420px]:flex-row min-[420px]:gap-4">
                        <dt className="text-ink-light min-[420px]:w-32 min-[420px]:shrink-0">Email</dt>
                        <dd className="min-w-0 break-all text-ink">{email}</dd>
                    </div>
                    <div className="flex min-w-0 flex-col gap-1 min-[420px]:flex-row min-[420px]:gap-4">
                        <dt className="text-ink-light min-[420px]:w-32 min-[420px]:shrink-0">Member since</dt>
                        <dd className="min-w-0 break-words text-ink">{joined}</dd>
                    </div>
                </dl>
            </div>

            <div className="mt-6 rounded-xl border border-gold/25 bg-white p-4 sm:p-6">
                <h2 className="mb-2 font-display text-xl font-semibold text-maroon-dark">
                    Order History
                </h2>
                <p className="text-[14px] text-ink-mid">
                    You have no orders yet. Order history will appear here once the
                    ERPNext integration is connected.
                </p>
                <Link
                    href="/collections/wedding"
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border-[1.5px] border-maroon px-4 py-2.5 text-center text-[13.5px] font-medium text-maroon transition hover:bg-maroon hover:text-gold-light sm:w-auto sm:px-6"
                >
                    Start Shopping →
                </Link>
            </div>
        </div>
    );
}
