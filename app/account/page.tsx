import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseAuthServerClient } from "@/lib/supabase/auth-server";
import AccountProfile from "@/components/AccountProfile";

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
  const fullName = user.user_metadata.full_name || user.user_metadata.name;
  const profile = {
    name: typeof fullName === "string" ? fullName : "",
    email: user.email || "",
  };
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-serif text-3xl font-semibold text-maroon">
        My Account
      </h1>
      <p className="mt-4 text-ink-light">
        Manage your contact details and password.
      </p>
      <AccountProfile key={user.id} profile={profile} />
      <div className="mt-8 flex flex-wrap gap-6">
        <Link href="/cart" className="underline">
          View cart
        </Link>
        <Link href="/wishlist" className="underline">
          View wishlist
        </Link>
        <Link href="/my-orders" className="underline">
          Order help
        </Link>
      </div>
    </main>
  );
}
