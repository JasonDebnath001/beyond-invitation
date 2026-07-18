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

function cleanEnv(value?: string) {
    return (value ?? "").trim().replace(/^["']|["']$/g, "");
}

export async function GET(request: NextRequest) {
    const provided = (request.nextUrl.searchParams.get("key") ?? "").trim();
    const expected = cleanEnv(process.env.DEBUG_KEY);

    if (!expected || provided !== expected) {
        // Diagnostic-safe: reveals whether the env var exists and lengths,
        // never the values themselves.
        return NextResponse.json(
            {
                error: "Not found",
                guard: {
                    keyProvidedInUrl: Boolean(provided),
                    providedLength: provided.length,
                    envKeyConfigured: Boolean(process.env.DEBUG_KEY),
                    envKeyLengthAfterCleaning: expected.length,
                },
            },
            { status: 404 },
        );
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