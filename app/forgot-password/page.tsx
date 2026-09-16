import type { Metadata } from "next";
import PasswordResetForm from "@/components/PasswordResetForm";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <main className="bg-paper px-4 py-10 sm:py-16">
      <PasswordResetForm />
    </main>
  );
}
