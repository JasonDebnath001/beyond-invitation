"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  authErrorMessage,
  validateAuthPassword,
} from "@/lib/auth";

export default function AccountProfile({
  profile,
}: {
  profile: { name: string; email: string };
}) {
  const router = useRouter();
  const [name, setName] = useState(profile.name);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (name.trim().length > 100)
        throw new Error("Enter your name using no more than 100 characters.");
      const { error } = await getSupabaseBrowserClient().auth.updateUser({
        data: { full_name: name.trim() },
      });
      if (error) throw error;
      setMessage("Your profile has been saved.");
      router.refresh();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      validateAuthPassword(password);
      if (password !== confirmPassword)
        throw new Error("The passwords do not match.");
      const { error } = await getSupabaseBrowserClient().auth.updateUser({
        password,
      });
      if (error) throw error;
      setPassword("");
      setConfirmPassword("");
      setMessage("Your password has been updated.");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error } = await getSupabaseBrowserClient().auth.signOut({
        scope: "local",
      });
      if (error) throw error;
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "mt-2 w-full rounded-xl border border-carbon/20 px-4 py-3";
  return (
    <div className="mt-8 space-y-8">
      <form
        onSubmit={saveProfile}
        className="space-y-5 rounded-2xl border border-gold/20 p-6"
      >
        <h2 className="text-xl font-semibold">Profile details</h2>
        <label className="block text-sm font-medium">
          Full name (optional)
          <input
            autoComplete="name"
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
          />
        </label>
        {profile.email && (
          <p className="text-sm text-ink-light">Email: {profile.email}</p>
        )}
        <button
          disabled={busy}
          className="rounded-full bg-carbon px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          Save profile
        </button>
      </form>
      <form
        onSubmit={savePassword}
        className="space-y-5 rounded-2xl border border-gold/20 p-6"
      >
        <h2 className="text-xl font-semibold">Set or change password</h2>
        <label className="block text-sm font-medium">
          New password
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium">
          Confirm new password
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className={inputClass}
          />
        </label>
        <button
          disabled={busy}
          className="rounded-full bg-carbon px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          Save password
        </button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-green-800">
          {message}
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={signOut}
        className="text-sm font-semibold underline disabled:opacity-50"
      >
        Sign out
      </button>
    </div>
  );
}
