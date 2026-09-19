import { NextResponse, type NextRequest } from "next/server";
import { adminData, loadItemContext } from "@/lib/admin/item-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const { companies, context } = await loadItemContext(request.nextUrl.searchParams.get("companyId") || undefined);
    return NextResponse.json(adminData(companies, context), { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
