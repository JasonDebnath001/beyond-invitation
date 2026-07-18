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
  const provided = (request.nextUrl.searchParams.get("key") ?? "").trim();
  const expected = "bi-debug-7712"; // temporary hardcoded key — route gets deleted after diagnosis

  if (provided !== expected) {
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
    host: request.nextUrl.host,
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