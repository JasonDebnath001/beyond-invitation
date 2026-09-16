"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAuthConfig } from "./auth-config";

export function getSupabaseBrowserClient() {
  const { url, key } = getSupabaseAuthConfig();
  return createBrowserClient(url, key);
}
