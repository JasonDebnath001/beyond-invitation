import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ClerkProvider } from "@clerk/nextjs";
import { Assistant } from "next/font/google";

import "./globals.css";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CookiesConsent from "@/components/CookiesConsent";
import { CartProvider } from "@/components/CartProvider";

const assistant = Assistant({
  subsets: ["latin"],
  weight: [
    "300",
    "400",
    "500",
    "600",
    "700",
    "800",
  ],
  variable: "--font-assistant",
  display: "swap",
});

export const metadata: Metadata = {
  title:
    "Beyond Invitation – Indian Wedding Invitation Cards",
  description:
    "Discover premium wedding invitation cards, shagun envelopes, boxes, and celebration stationery by Beyond Invitation.",
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({
  children,
}: RootLayoutProps) {
  return (
    <ClerkProvider>
      <html lang="en" className={assistant.variable}>
        <body className="min-h-screen bg-white font-sans text-carbon antialiased">
          <CartProvider>
            <Navbar />

            <main>{children}</main>

            <Footer />

            <CookiesConsent />
          </CartProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}