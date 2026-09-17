import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LifeBuoy, ArrowUpRight } from "lucide-react";
import { getSupabaseAuthServerClient } from "@/lib/supabase/auth-server";
import { displayName, initials, hasEmailIdentity, fetchRecentWebsiteOrders, fetchSavedProducts, fetchAccountCounts } from "@/lib/account";
import AccountMotion from "@/components/account/AccountMotion";
import AccountShell from "@/components/account/AccountShell";
import AccountHeader from "@/components/account/AccountHeader";
import AccountStats from "@/components/account/AccountStats";
import AccountOrders from "@/components/account/AccountOrders";
import AccountSaved from "@/components/account/AccountSaved";
import ProfileForm from "@/components/account/ProfileForm";
import PasswordForm from "@/components/account/PasswordForm";
import SignOutButtons from "@/components/account/SignOutButtons";
import { cardClass, linkClass, secondaryClass, SectionHeading } from "@/components/account/AccountUI";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Account | Beyond Invitation",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const supabase = await getSupabaseAuthServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/sign-in?next=%2Faccount");
  const [orders, products, counts] = await Promise.all([
    fetchRecentWebsiteOrders(supabase, user.id),
    fetchSavedProducts(supabase, user.id),
    fetchAccountCounts(supabase, user.id),
  ]);
  const fullName = [user.user_metadata.full_name, user.user_metadata.name]
    .find((value) => typeof value === "string" && value.trim());
  const profile = {
    name: typeof fullName === "string" ? fullName : "",
    email: user.email || "",
  };
  const providers = Array.from(new Set((user.identities ?? [])
    .map(({ provider }) => provider === "google" ? "Google" : provider === "email" ? "Email" : "")
    .filter(Boolean)));
  const memberSince = new Intl.DateTimeFormat("en-IN", {
    month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  }).format(new Date(user.created_at));
  return (
    <AccountMotion key={user.id}>
      <AccountShell header={<AccountHeader firstName={displayName(user).split(/\s+/)[0]} monogram={initials(user)}
        email={profile.email} memberSince={memberSince}
        avatarUrl={typeof user.user_metadata.avatar_url === "string" ? user.user_metadata.avatar_url : ""} />}>
        <AccountStats {...counts} />
        <AccountOrders orders={orders} />
        <AccountSaved products={products} />
        <section id="profile" aria-labelledby="profile-heading" data-motion="section" className={cardClass}>
          <SectionHeading id="profile-heading">Your details</SectionHeading>
          <ProfileForm profile={profile} providers={providers} />
        </section>
        <section id="security" aria-labelledby="security-heading" data-motion="section" className={cardClass}>
          <SectionHeading id="security-heading">{hasEmailIdentity(user) ? "Change password" : "Set a password"}</SectionHeading>
          <PasswordForm />
          <div className="mt-7 border-t border-gold/20 pt-5"><SignOutButtons /></div>
        </section>
      </AccountShell>
    </AccountMotion>
  );
}
