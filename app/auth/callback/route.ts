import { NextResponse } from "next/server";
import { getSupabaseAuthServerClient } from "@/lib/supabase/auth-server";
import { safeAuthRedirect } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeAuthRedirect(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  let destination = `/sign-in?error=callback&next=${encodeURIComponent(next)}`;

  if (!url.searchParams.has("error")) {
    try {
      if (tokenHash && (type === "email" || type === "recovery")) {
        const supabase = await getSupabaseAuthServerClient();
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (!error) destination = next;
      } else if (code && !tokenHash) {
        const supabase = await getSupabaseAuthServerClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) destination = next;
      }
    } catch {
      // Return a retryable message without exposing authentication codes or tokens.
    }
  }

  const response = NextResponse.redirect(new URL(destination, url.origin));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
