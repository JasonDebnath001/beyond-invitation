"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth";
import { focusClass, secondaryClass } from "./AccountUI";

export default function SignOutButtons({ showAll = true }: { showAll?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signOut(scope: "local" | "global") {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const { error } = await getSupabaseBrowserClient().auth.signOut({ scope });
      if (error) throw error;
      router.replace("/"); router.refresh();
    } catch (err) { setError(authErrorMessage(err)); }
    finally { setBusy(false); }
  }
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <button type="button" data-testid="sign-out" disabled={busy} onClick={() => signOut("local")}
          className={`inline-flex items-center gap-2 rounded-full py-2.5 text-sm font-semibold text-carbon transition-colors hover:text-carbon-dark disabled:opacity-50 ${focusClass}`}>
          <LogOut aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />Sign out
        </button>
        {showAll && <button type="button" data-testid="sign-out-all" disabled={busy} onClick={() => signOut("global")} className={secondaryClass}>Sign out of all devices</button>}
      </div>
      {error && <p role="alert" className="mt-3 rounded-2xl bg-maroon/5 px-4 py-2 text-sm text-maroon motion-safe:animate-fadeUp">{error}</p>}
    </div>
  );
}
