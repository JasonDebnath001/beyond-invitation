import "server-only";

import { getSupabaseAuthServerClient } from "@/lib/supabase/auth-server";

export class FulfillmentAdminError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "FulfillmentAdminError";
  }
}

/** Only trusted server-managed metadata or an explicit UUID allowlist grants access. */
export async function getFulfillmentAdmin(): Promise<{ id: string }> {
  const auth = await getSupabaseAuthServerClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) {
    throw new FulfillmentAdminError("SIGN_IN_REQUIRED", "Sign in to access order shipping.", 401);
  }
  const allowedIds = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id));
  if (user.app_metadata?.role !== "admin" && !allowedIds.includes(user.id.toLowerCase())) {
    throw new FulfillmentAdminError("ADMIN_REQUIRED", "Your account does not have access to order shipping. Ask the site owner to grant staff access.", 403);
  }
  return { id: user.id };
}
