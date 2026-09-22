import Link from "next/link";
import { ArrowUpRight, Clock3 } from "lucide-react";
import { blogDate, type BlogSummary } from "@/lib/blog";
import BlogImage from "./BlogImage";
import styles from "./Blog.module.css";

export default function BlogCard({ post }: { post: BlogSummary }) {
  return (
    <article className={styles.card}>
      <Link
        href={`/blog/${post.slug}`}
        className={styles.cardImage}
        tabIndex={-1}
        aria-hidden="true"
      >
        <BlogImage src={post.cover_image} alt="" />
      </Link>
      <div className={styles.cardBody}>
        <div className={styles.meta}>
          <span>{post.category}</span>
          <span>
            <Clock3 size={13} />
            {post.reading_minutes} min read
          </span>
        </div>
        <h3>
          <Link href={`/blog/${post.slug}`}>{post.title}</Link>
        </h3>
        <p>{post.excerpt}</p>
        <div className={styles.cardBottom}>
          <div className={styles.cardByline}>
            <span>By {post.author}</span>
            <time dateTime={post.published_at || undefined}>
              {blogDate(post.published_at)}
            </time>
          </div>
          <Link href={`/blog/${post.slug}`} aria-label={`Read ${post.title}`}>
            <ArrowUpRight size={20} />
          </Link>
        </div>
      </div>
    </article>
  );
}
