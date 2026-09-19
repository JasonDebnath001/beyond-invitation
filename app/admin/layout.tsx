import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Item admin", robots: { index: false, follow: false, noarchive: true, googleBot: { index: false, follow: false, noimageindex: true } } };
export default function AdminLayout({ children }: { children: ReactNode }) { return children; }
