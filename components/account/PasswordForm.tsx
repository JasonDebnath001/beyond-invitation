"use client";

import { useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { authErrorMessage, validateAuthPassword } from "@/lib/auth";
import { inputClass, labelClass, primaryClass } from "./AccountUI";

export default function PasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      validateAuthPassword(password);
      if (password !== confirmPassword) throw new Error("The passwords do not match.");
      const { error } = await getSupabaseBrowserClient().auth.updateUser({ password });
      if (error) throw error;
      setPassword(""); setConfirmPassword("");
      setMessage("Your password has been updated.");
    } catch (err) { setError(authErrorMessage(err)); }
    finally { setBusy(false); }
  }

  return (
    <form data-testid="password-form" onSubmit={savePassword} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className={labelClass}>New password
          <input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128}
            value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>Confirm new password
          <input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128}
            value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={inputClass} />
        </label>
      </div>
      {error && <p role="alert" className="flex items-start gap-2 rounded-2xl bg-maroon/5 px-4 py-2 text-sm text-maroon motion-safe:animate-fadeUp"><ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
      {message && <p role="status" className="flex items-start gap-2 rounded-2xl bg-emerald-50 px-4 py-2 text-sm text-emerald-800 motion-safe:animate-fadeUp"><ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />{message}</p>}
      <button disabled={busy} className={primaryClass}>{busy ? "Saving…" : "Save password"}</button>
    </form>
  );
}
