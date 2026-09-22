import Link from "next/link";
import styles from "@/components/blog/Blog.module.css";
export default function ArticleNotFound() {
  return <div className={`${styles.page} ${styles.empty}`}><span className={styles.eyebrow}>THE JOURNAL</span><h1>This chapter isn’t here.</h1><p>The story may have moved or is no longer published.</p><Link href="/blog" className={styles.secondaryButton}>Explore the journal</Link></div>;
}
