"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { authErrorMessage, normalizeAuthEmail } from "@/lib/auth";

export default function PasswordResetForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || sent) return;
    setBusy(true);
    setError("");
    try {
      const normalizedEmail = normalizeAuthEmail(email);
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", "/account");
      const { error } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: callback.toString(),
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-md rounded-3xl border border-gold/20 bg-white p-6 shadow-sm sm:p-9">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold">Beyond Invitation</p>
      <h1 className="mt-3 font-serif text-3xl font-semibold text-maroon">Forgot your password?</h1>
      <p className="mb-7 mt-3 text-sm text-ink-light">Enter your email address to receive a password reset link.</p>
      <form onSubmit={submit} className="space-y-5">
        <label className="block text-sm font-medium">Email address
          <input name="email" type="email" required autoComplete="email" autoCapitalize="none" spellCheck={false}
            maxLength={254} placeholder="you@example.com" value={email}
            onChange={(event) => { setEmail(event.target.value); setSent(false); setError(""); }}
            className="mt-2 w-full rounded-xl border border-carbon/20 px-4 py-3" />
        </label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {sent && <p role="status" className="text-sm text-green-800">If an account exists for this email, you will receive a reset link. Follow it to set a new password in My Account.</p>}
        <button disabled={busy || sent} className="w-full rounded-full bg-carbon px-6 py-3 font-semibold text-white hover:bg-maroon disabled:opacity-50">
          {busy ? "Please wait..." : sent ? "Check your inbox" : "Send reset link"}
        </button>
      </form>
      <Link href="/sign-in" className="mt-4 inline-block text-sm underline">Back to sign in</Link>
    </section>
  );
}
