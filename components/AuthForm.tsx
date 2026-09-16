"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSupabaseAuthConfig } from "@/lib/supabase/auth-config";
import { authErrorMessage, normalizeAuthEmail, safeAuthRedirect, validateAuthPassword } from "@/lib/auth";

export default function AuthForm({ mode, next, callbackError = false }: { mode: "sign-in" | "sign-up"; next: string; callbackError?: boolean }) {
  const router = useRouter();
  const signup = mode === "sign-up";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(callbackError ? "Sign-in could not be completed. Please try again or request a new email link." : "");
  const [message, setMessage] = useState("");

  function finish() {
    setPassword("");
    router.replace(safeAuthRedirect(next));
    router.refresh();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(""); setMessage(""); setBusy(true);
    try {
      const normalizedEmail = normalizeAuthEmail(email);
      const supabase = getSupabaseBrowserClient();
      if (signup) {
        validateAuthPassword(password);
        const callback = new URL("/auth/callback", window.location.origin);
        callback.searchParams.set("next", safeAuthRedirect(next));
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail, password,
          options: { emailRedirectTo: callback.toString() },
        });
        if (error) throw error;
        setPassword("");
        if (data.session) finish();
        else setMessage("Check your inbox for a confirmation link, then sign in with your email and password.");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error) throw error;
        if (!data.session) throw new Error("Sign-in could not be completed. Please try again.");
        finish();
      }
    } catch (err) { setError(authErrorMessage(err)); }
    finally { setBusy(false); }
  }

  async function google() {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      // The settings endpoint is public. Check before leaving the storefront.
      const { url, key } = getSupabaseAuthConfig();
      const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
      if (!response.ok) throw new Error("Google sign-in is temporarily unavailable. Please try again later.");
      const settings = await response.json();
      if (!settings.external?.google) throw new Error("Google sign-in is temporarily unavailable. Please try again later.");
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", safeAuthRedirect(next));
      const { error } = await getSupabaseBrowserClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback.toString() } });
      if (error) throw error;
    } catch (err) { setError(authErrorMessage(err)); setBusy(false); }
  }

  return (
    <section className="mx-auto w-full max-w-md rounded-3xl border border-gold/20 bg-white p-6 shadow-sm sm:p-9">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold">Beyond Invitation</p>
      <h1 className="mt-3 font-serif text-3xl font-semibold text-maroon">{signup ? "Create your account" : "Welcome back"}</h1>
      <p className="mb-7 mt-3 text-sm text-ink-light">{signup ? "Create an account with your email address and password." : "Sign in with Google or your email address and password."}</p>
      <button type="button" onClick={google} disabled={busy}
        className="flex w-full items-center justify-center gap-3 rounded-full border border-carbon/20 px-4 py-3 font-semibold transition hover:bg-paper disabled:opacity-50">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.97-3.38.97-2.6 0-4.81-1.76-5.6-4.12H3.05v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.93A6 6 0 0 1 6.08 12c0-.67.12-1.32.32-1.93V7.48H3.05A10 10 0 0 0 2 12c0 1.61.39 3.14 1.05 4.52l3.35-2.59Z"/><path fill="#EA4335" d="M12 5.95c1.47 0 2.79.51 3.82 1.51l2.87-2.87A9.57 9.57 0 0 0 12 2a10 10 0 0 0-8.95 5.48l3.35 2.59c.79-2.36 3-4.12 5.6-4.12Z"/></svg>
        Continue with Google
      </button>
      <div className="my-6 flex items-center gap-3 text-xs text-ink-light"><span className="h-px flex-1 bg-carbon/10" />or use your email<span className="h-px flex-1 bg-carbon/10" /></div>
      <form onSubmit={submit} className="space-y-5">
        <label className="block text-sm font-medium">Email address
          <input name="email" type="email" required autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-carbon/20 px-4 py-3" />
        </label>
        <label className="block text-sm font-medium">Password
          <span className="relative mt-2 block">
            <input name="password" type={showPassword ? "text" : "password"} required minLength={signup ? 8 : undefined} maxLength={128} autoComplete={signup ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-carbon/20 py-3 pl-4 pr-16" />
            <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-3 text-xs underline">{showPassword ? "Hide" : "Show"}</button>
          </span>
          {signup && <span className="mt-1 block text-xs font-normal text-ink-light">At least 8 characters.</span>}
        </label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="text-sm text-green-800">{message}</p>}
        <button disabled={busy} className="w-full rounded-full bg-carbon px-6 py-3 font-semibold text-white transition hover:bg-maroon disabled:opacity-50">{busy ? "Please wait..." : signup ? "Create account" : "Sign in"}</button>
      </form>
      {!signup && <Link href="/forgot-password" className="mt-4 inline-block text-sm underline">Forgot password?</Link>}
      <p className="mt-6 text-center text-sm text-ink-light">{signup ? "Already have an account? " : "New to Beyond Invitation? "}<Link href={`/${signup ? "sign-in" : "sign-up"}?next=${encodeURIComponent(safeAuthRedirect(next))}`} className="font-semibold text-carbon underline">{signup ? "Sign in" : "Create account"}</Link></p>
    </section>
  );
}
