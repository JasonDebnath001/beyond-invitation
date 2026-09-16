import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";
import { safeAuthRedirect } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="bg-paper px-4 py-10 sm:py-16">
      <AuthForm
        mode="sign-in"
        next={safeAuthRedirect(params.next)}
        callbackError={params.error === "callback"}
      />
    </main>
  );
}
