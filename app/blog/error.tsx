"use client";
import Link from "next/link";
import styles from "@/components/blog/Blog.module.css";
export default function BlogError({ reset }: { reset: () => void }) {
  return <div className={`${styles.page} ${styles.empty}`}><span className={styles.eyebrow}>THE JOURNAL</span><h1>This story is taking a little longer.</h1><p>Please try again in a moment.</p><button className={styles.secondaryButton} onClick={reset}>Try again</button><Link href="/blog">Back to the journal</Link></div>;
}
