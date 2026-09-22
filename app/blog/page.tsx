import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedBlogs } from "@/lib/blog-server";
import type { BlogSummary } from "@/lib/blog";
import BlogBrowser from "@/components/blog/BlogBrowser";
import styles from "@/components/blog/Blog.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "The Journal — Wedding Inspiration & Invitation Guides",
  description:
    "Thoughtful ideas for meaningful celebrations. Explore wedding inspiration, invitation guides, traditions and the craft behind Beyond Invitation.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "The Beyond Invitation Journal",
    description: "Stories, ideas and details for a beautiful beginning.",
    url: "/blog",
    type: "website",
  },
};

export default async function BlogPage() {
  let posts: BlogSummary[] = [];
  let unavailable = false;
  try {
    posts = await getPublishedBlogs();
  } catch {
    unavailable = true;
    console.error("Blog listing is currently unavailable.");
  }
  return (
    <div className={styles.page}>
      <header className={styles.journalHeader}>
        <div className={styles.container}>
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span>/</span>
            <span aria-current="page">The Journal</span>
          </nav>
          <div className={styles.journalIntro}>
            <div>
              <span className={styles.eyebrow}>IDEAS FOR MEANINGFUL CELEBRATIONS</span>
              <h1>The Journal<span aria-hidden="true">.</span></h1>
            </div>
            <p>Wedding inspiration, thoughtful traditions and notes on the craft of a beautiful invitation.</p>
          </div>
        </div>
      </header>
      <div className={styles.container}>
        <BlogBrowser posts={posts} unavailable={unavailable} />
      </div>
    </div>
  );
}
