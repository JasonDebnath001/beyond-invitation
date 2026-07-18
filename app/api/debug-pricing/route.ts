import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
    RESELLER_COOKIE,
    getResellerByCode,
    getActiveResellerFromCookies,
    applyMarginToPrice,
} from "@/lib/reseller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    // Simple guard so this isn't world-readable. Call it as:
    // /api/debug-pricing?key=YOUR_SECRET
    if (request.nextUrl.searchParams.get("key") !== process.env.DEBUG_KEY) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const store = await cookies();
    const cookieValue = store.get(RESELLER_COOKIE)?.value ?? null;

    let byCode = null;
    let byCodeError = "";
    if (cookieValue) {
        try {
            byCode = await getResellerByCode(cookieValue);
        } catch (e) {
            byCodeError = e instanceof Error ? e.message : String(e);
        }
    }

    const activeReseller = await getActiveResellerFromCookies();

    return NextResponse.json({
        cookiePresent: Boolean(cookieValue),
        cookieValue,
        lookupResult: byCode,
        lookupError: byCodeError,
        activeResellerResolved: Boolean(activeReseller),
        marginPercent: activeReseller?.marginPercent ?? null,
        samplePrice_100_becomes: activeReseller
            ? applyMarginToPrice(100, activeReseller.marginPercent)
            : 100,
    });
}