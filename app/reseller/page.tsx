"use client";

import { useEffect, useMemo, useState } from "react";

type Profile = {
    code: string;
    resellerName: string;
    email: string;
    phone: string;
    marginPercent: number;
    active: boolean;
    maxMarginPercent: number;
    urlParam: string;
    siteUrl: string;
};

export default function ResellerPage() {
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [error, setError] = useState("");

    // Registration form
    const [resellerName, setResellerName] = useState("");
    const [phone, setPhone] = useState("");
    const [regMargin, setRegMargin] = useState("10");
    const [submitting, setSubmitting] = useState(false);

    // Margin editor
    const [marginInput, setMarginInput] = useState("");
    const [savingMargin, setSavingMargin] = useState(false);
    const [marginSaved, setMarginSaved] = useState(false);

    // Link generator
    const [productUrl, setProductUrl] = useState("");
    const [copied, setCopied] = useState<"link" | "home" | null>(null);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const res = await fetch("/api/reseller", { cache: "no-store" });
                const json = await res.json();

                if (cancelled) return;

                if (json?.registered && json.profile) {
                    setProfile(json.profile);
                    setMarginInput(String(json.profile.marginPercent));
                }
            } catch {
                if (!cancelled) setError("Could not load your reseller profile.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    async function handleRegister(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setError("");

        try {
            const res = await fetch("/api/reseller", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    resellerName,
                    phone,
                    marginPercent: Number(regMargin) || 0,
                }),
            });

            const json = await res.json();

            if (!res.ok) {
                setError(json?.error || "Registration failed.");
                return;
            }

            setProfile(json.profile);
            setMarginInput(String(json.profile.marginPercent));
        } catch {
            setError("Registration failed. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    async function handleSaveMargin() {
        if (!profile) return;
        setSavingMargin(true);
        setMarginSaved(false);
        setError("");

        try {
            const res = await fetch("/api/reseller", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ marginPercent: Number(marginInput) || 0 }),
            });

            const json = await res.json();

            if (!res.ok) {
                setError(json?.error || "Could not save margin.");
                return;
            }

            setProfile(json.profile);
            setMarginInput(String(json.profile.marginPercent));
            setMarginSaved(true);
            setTimeout(() => setMarginSaved(false), 2500);
        } catch {
            setError("Could not save margin. Please try again.");
        } finally {
            setSavingMargin(false);
        }
    }

    const generatedLink = useMemo(() => {
        if (!profile) return "";

        const base = productUrl.trim() || profile.siteUrl;

        try {
            const url = new URL(
                base.startsWith("http") ? base : `${profile.siteUrl}${base.startsWith("/") ? "" : "/"}${base}`,
            );

            // Only allow links to this website.
            const site = new URL(profile.siteUrl);
            if (url.hostname !== site.hostname) return "";

            url.searchParams.set(profile.urlParam, profile.code);
            return url.toString();
        } catch {
            return "";
        }
    }, [productUrl, profile]);

    const homeLink = useMemo(() => {
        if (!profile) return "";
        return `${profile.siteUrl}/?${profile.urlParam}=${profile.code}`;
    }, [profile]);

    async function copyText(text: string, which: "link" | "home") {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(which);
            setTimeout(() => setCopied(null), 2000);
        } catch {
            // Clipboard unavailable — the field is selectable as a fallback.
        }
    }

    if (loading) {
        return (
            <div className="mx-auto max-w-3xl px-4 py-20 text-center text-ink-light">
                Loading your reseller account…
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-gold">
                Partner Program
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold text-carbon sm:text-4xl">
                Reseller Dashboard
            </h1>

            {error && (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {!profile ? (
                /* ---------------- Registration ---------------- */
                <form
                    onSubmit={handleRegister}
                    className="mt-8 space-y-5 rounded-2xl border border-gold/15 bg-white p-6 shadow-sm"
                >
                    <p className="text-sm text-ink-light">
                        Create your reseller account. You will get a personal referral
                        code — share any page of this website with your code and your
                        customers automatically see prices with your margin added. You
                        earn the difference on every order.
                    </p>

                    <div>
                        <label className="block text-sm font-medium text-carbon">
                            Business / reseller name *
                        </label>
                        <input
                            value={resellerName}
                            onChange={(e) => setResellerName(e.target.value)}
                            required
                            className="mt-1 w-full rounded-lg border border-gold/25 px-3 py-2 text-sm outline-none focus:border-gold"
                            placeholder="e.g. Sharma Wedding Services"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-carbon">
                            Phone
                        </label>
                        <input
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-gold/25 px-3 py-2 text-sm outline-none focus:border-gold"
                            placeholder="Mobile number"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-carbon">
                            Default profit margin (%)
                        </label>
                        <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={regMargin}
                            onChange={(e) => setRegMargin(e.target.value)}
                            className="mt-1 w-40 rounded-lg border border-gold/25 px-3 py-2 text-sm outline-none focus:border-gold"
                        />
                        <p className="mt-1 text-xs text-ink-light">
                            You can change this any time from your dashboard.
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="rounded-full bg-carbon px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-carbon/90 disabled:opacity-60"
                    >
                        {submitting ? "Creating…" : "Create reseller account"}
                    </button>
                </form>
            ) : (
                /* ---------------- Dashboard ---------------- */
                <div className="mt-8 space-y-6">
                    <section className="rounded-2xl border border-gold/15 bg-white p-6 shadow-sm">
                        <h2 className="font-display text-lg font-semibold text-carbon">
                            Your referral code
                        </h2>
                        <div className="mt-3 inline-flex items-center gap-3 rounded-xl bg-carbon px-5 py-3">
                            <span className="font-mono text-xl tracking-[0.3em] text-gold">
                                {profile.code}
                            </span>
                        </div>
                        {!profile.active && (
                            <p className="mt-3 text-sm text-red-600">
                                Your account is currently inactive. Contact us to activate it.
                            </p>
                        )}
                    </section>

                    <section className="rounded-2xl border border-gold/15 bg-white p-6 shadow-sm">
                        <h2 className="font-display text-lg font-semibold text-carbon">
                            Profit margin
                        </h2>
                        <p className="mt-1 text-sm text-ink-light">
                            Prices shown to customers arriving through your links are
                            increased by this percentage. Max{" "}
                            {profile.maxMarginPercent}%.
                        </p>
                        <div className="mt-4 flex items-center gap-3">
                            <input
                                type="number"
                                min={0}
                                max={profile.maxMarginPercent}
                                step={0.5}
                                value={marginInput}
                                onChange={(e) => setMarginInput(e.target.value)}
                                className="w-32 rounded-lg border border-gold/25 px-3 py-2 text-sm outline-none focus:border-gold"
                            />
                            <span className="text-sm text-ink-light">%</span>
                            <button
                                onClick={handleSaveMargin}
                                disabled={savingMargin}
                                className="rounded-full bg-carbon px-5 py-2 text-sm font-semibold text-white transition hover:bg-carbon/90 disabled:opacity-60"
                            >
                                {savingMargin ? "Saving…" : "Save"}
                            </button>
                            {marginSaved && (
                                <span className="text-sm font-medium text-green-600">
                                    Saved ✓
                                </span>
                            )}
                        </div>
                        <p className="mt-2 text-xs text-ink-light">
                            Note: changing the margin affects all future visits through
                            your links, including customers who already have your link.
                        </p>
                    </section>

                    <section className="rounded-2xl border border-gold/15 bg-white p-6 shadow-sm">
                        <h2 className="font-display text-lg font-semibold text-carbon">
                            Create a shareable link
                        </h2>
                        <p className="mt-1 text-sm text-ink-light">
                            Paste any product or page URL from this website. Your code is
                            added automatically — when the customer opens it, the link
                            cleans itself and your margin is applied silently.
                        </p>

                        <input
                            value={productUrl}
                            onChange={(e) => setProductUrl(e.target.value)}
                            className="mt-4 w-full rounded-lg border border-gold/25 px-3 py-2 text-sm outline-none focus:border-gold"
                            placeholder={`${profile.siteUrl}/products/…`}
                        />

                        {generatedLink ? (
                            <div className="mt-3 flex items-center gap-2">
                                <input
                                    readOnly
                                    value={generatedLink}
                                    onFocus={(e) => e.currentTarget.select()}
                                    className="w-full rounded-lg border border-gold/25 bg-gold/5 px-3 py-2 font-mono text-xs text-carbon outline-none"
                                />
                                <button
                                    onClick={() => copyText(generatedLink, "link")}
                                    className="shrink-0 rounded-full border border-carbon px-4 py-2 text-xs font-semibold text-carbon transition hover:bg-carbon hover:text-white"
                                >
                                    {copied === "link" ? "Copied ✓" : "Copy"}
                                </button>
                            </div>
                        ) : productUrl.trim() ? (
                            <p className="mt-2 text-xs text-red-600">
                                Please enter a valid link from this website.
                            </p>
                        ) : null}

                        <div className="mt-5 border-t border-gold/10 pt-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-ink-light">
                                Quick link — whole store
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                                <input
                                    readOnly
                                    value={homeLink}
                                    onFocus={(e) => e.currentTarget.select()}
                                    className="w-full rounded-lg border border-gold/25 bg-gold/5 px-3 py-2 font-mono text-xs text-carbon outline-none"
                                />
                                <button
                                    onClick={() => copyText(homeLink, "home")}
                                    className="shrink-0 rounded-full border border-carbon px-4 py-2 text-xs font-semibold text-carbon transition hover:bg-carbon hover:text-white"
                                >
                                    {copied === "home" ? "Copied ✓" : "Copy"}
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}