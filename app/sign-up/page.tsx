import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";
import { safeAuthRedirect } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Create account",
  robots: { index: false, follow: false },
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="bg-paper px-4 py-10 sm:py-16">
      <AuthForm mode="sign-up" next={safeAuthRedirect(params.next)} />
    </main>
  );
}
