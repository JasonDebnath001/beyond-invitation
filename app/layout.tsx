import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { Assistant } from "next/font/google";

import "./globals.css";

import { SITE_NAME } from "@/components/siteConfig";
import {
  getSiteUrl,
  DEFAULT_OG_IMAGE,
} from "@/lib/site-config";

import SiteLoader from "@/components/SiteLoader";
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

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: `${SITE_NAME} – Wedding Invitation Cards`,
    template: `%s | ${SITE_NAME}`,
  },

  description:
    "Discover premium wedding invitation cards, shagun envelopes, boxes, and celebration stationery by Beyond Invitation.",

  applicationName: SITE_NAME,

  authors: [
    {
      name: "Bharat Agency Wedding Cards Pvt. Ltd.",
    },
  ],

  creator: SITE_NAME,
  publisher: SITE_NAME,

  keywords: [
    "wedding invitation cards",
    "wedding cards Kolkata",
    "shagun envelopes",
    "rakhi packaging",
  ],

  openGraph: {
    title: SITE_NAME,

    description:
      "Discover premium wedding invitation cards, shagun envelopes, boxes, and celebration stationery by Beyond Invitation.",

    url: siteUrl,
    siteName: SITE_NAME,
    type: "website",

    images: [
      {
        url: `${siteUrl}${DEFAULT_OG_IMAGE}`,
        width: 1200,
        height: 630,
        alt: SITE_NAME,
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,

    description:
      "Discover premium wedding invitation cards, shagun envelopes, boxes, and celebration stationery by Beyond Invitation.",
  },

  robots: {
    index: true,
    follow: true,
  },

  formatDetection: {
    telephone: false,
  },

  icons: {
    icon: "/logo.ico",
  },
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({
  children,
}: RootLayoutProps) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={assistant.variable}
      >
        <body className="min-h-screen bg-white font-sans text-carbon antialiased">
          <SiteLoader />

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