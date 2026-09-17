"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth";
import { inputClass, labelClass, primaryClass } from "./AccountUI";

export default function ProfileForm({ profile, providers }: {
  profile: { name: string; email: string }; providers: string[];
}) {
  const router = useRouter();
  const [name, setName] = useState(profile.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      if (name.trim().length > 100) throw new Error("Enter your name using no more than 100 characters.");
      const { error } = await getSupabaseBrowserClient().auth.updateUser({ data: { full_name: name.trim() } });
      if (error) throw error;
      setMessage("Your profile has been saved.");
      router.refresh();
    } catch (err) { setError(authErrorMessage(err)); }
    finally { setBusy(false); }
  }

  return (
    <form data-testid="profile-form" onSubmit={saveProfile} className="space-y-5">
      <label className={labelClass}>
        Full name <span className="font-normal normal-case tracking-normal">(optional)</span>
        <input name="fullName" autoComplete="name" maxLength={100} value={name}
          onChange={(event) => setName(event.target.value)} className={inputClass} />
      </label>
      <div>
        <label htmlFor="account-email" className={labelClass}>Email</label>
        <div className="relative mt-2 flex min-w-0 flex-wrap items-center gap-x-3 rounded-xl border border-carbon/15 bg-paper px-4 py-1">
          <input id="account-email" type="email" autoComplete="email" readOnly value={profile.email}
            className="min-w-0 flex-[1_1_200px] rounded-md bg-transparent py-2 text-[15px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50" />
          <div className="flex gap-2 py-1">
            {providers.map((provider) => <span key={provider} className="rounded-full border border-gold/30 bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-mid">{provider}</span>)}
          </div>
        </div>
      </div>
      {error && <p role="alert" className="flex items-start gap-2 rounded-2xl bg-maroon/5 px-4 py-2 text-sm text-maroon motion-safe:animate-fadeUp"><Mail aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
      {message && <p role="status" className="flex items-start gap-2 rounded-2xl bg-emerald-50 px-4 py-2 text-sm text-emerald-800 motion-safe:animate-fadeUp"><Mail aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />{message}</p>}
      <button disabled={busy} className={primaryClass}>{busy ? "Saving…" : "Save profile"}</button>
    </form>
  );
}
