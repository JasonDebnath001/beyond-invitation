import { NextResponse } from "next/server";

/** Account self-service is unavailable while the storefront has no authentication. */
function unavailable() {
  return NextResponse.json(
    { error: "Online reseller account management is unavailable. Please contact our team." },
    { status: 410 },
  );
}

export const GET = unavailable;
export const POST = unavailable;
export const PATCH = unavailable;
