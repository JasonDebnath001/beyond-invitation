"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, Clock3, Search, X } from "lucide-react";
import { BLOG_CATEGORIES, blogDate, type BlogSummary } from "@/lib/blog";
import BlogImage from "./BlogImage";
import BlogCard from "./BlogCard";
import styles from "./Blog.module.css";

export default function BlogBrowser({
  posts,
  unavailable = false,
}: {
  posts: BlogSummary[];
  unavailable?: boolean;
}) {
  const [category, setCategory] = useState("All stories");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(9);
  const featured = posts.find((post) => post.featured) || posts[0];
  const filtering = category !== "All stories" || !!query.trim();
  const results = useMemo(
    () =>
      posts.filter(
        (post) =>
          (category === "All stories" || post.category === category) &&
          `${post.title} ${post.excerpt} ${post.category} ${post.author}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()) &&
          (filtering || post.id !== featured?.id),
      ),
    [posts, category, query, filtering, featured],
  );
  return (
    <section
      className={styles.stories}
      id="stories"
      aria-label="Journal stories"
    >
      <div className={styles.browseBar}>
        <div
          className={styles.categories}
          aria-label="Filter stories by category"
        >
          {["All stories", ...BLOG_CATEGORIES].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={category === value}
              className={category === value ? styles.categoryActive : ""}
              onClick={() => {
                setCategory(value);
                setLimit(9);
              }}
            >
              {value}
            </button>
          ))}
        </div>
        <div className={styles.search}>
          <Search size={17} />
          <input
            aria-label="Search stories"
            type="search"
            placeholder="Find a little inspiration…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLimit(9);
            }}
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                setLimit(9);
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
      {!filtering && featured && (
        <article className={styles.featured}>
          <Link
            href={`/blog/${featured.slug}`}
            className={styles.featuredImage}
            tabIndex={-1}
            aria-hidden="true"
          >
            <BlogImage src={featured.cover_image} alt="" priority />
          </Link>
          <div className={styles.featuredContent}>
            <span className={styles.eyebrow}>THE EDITOR’S PICK</span>
            <div className={styles.meta}>
              <span>{featured.category}</span>
              <span>
                <Clock3 size={14} />
                {featured.reading_minutes} min read
              </span>
            </div>
            <h2>
              <Link href={`/blog/${featured.slug}`}>{featured.title}</Link>
            </h2>
            <p>{featured.excerpt}</p>
            <div className={styles.featuredFooter}>
              <span>
                By {featured.author}
                <small>{blogDate(featured.published_at)}</small>
              </span>
              <Link
                href={`/blog/${featured.slug}`}
                className={styles.roundLink}
                aria-label={`Read ${featured.title}`}
              >
                <ArrowRight size={22} />
              </Link>
            </div>
          </div>
        </article>
      )}
      {!!results.length && (
        <>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>
                {filtering
                  ? "A LITTLE CLOSER TO YOUR VISION"
                  : "NOTES FROM OUR JOURNAL"}
              </span>
              <h2>
                {filtering
                  ? "Your inspiration, found."
                  : "Ideas for a beautiful beginning."}
              </h2>
            </div>
            <span className={styles.resultCount} aria-live="polite">
              {results.length} {results.length === 1 ? "story" : "stories"}
            </span>
          </div>
          <div className={styles.grid}>
            {results.slice(0, limit).map((post) => (
              <BlogCard key={post.id} post={post} />
            ))}
          </div>
          {results.length > limit && (
            <div className={styles.loadMore}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setLimit((value) => value + 9)}
              >
                More stories <ArrowRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
      {!results.length && (filtering || !featured) && (
        <div className={styles.empty} role="status">
          <BookOpen size={36} strokeWidth={1} />
          <span className={styles.eyebrow}>
            {filtering ? "KEEP EXPLORING" : "THE NEXT CHAPTER"}
          </span>
          <h2>
            {filtering
              ? "A different search may spark an idea."
              : unavailable
                ? "Our journal will be back shortly."
                : "Beautiful stories are on their way."}
          </h2>
          <p>
            {filtering
              ? "Try another word or explore all our stories."
              : unavailable
                ? "Please check back in a little while. There is plenty of inspiration in our collections."
                : "We’re gathering inspiration, thoughtful guides and stories from our craft. Until then, find your first spark in our collections."}
          </p>
          {filtering ? (
            <button
              className={styles.secondaryButton}
              onClick={() => {
                setCategory("All stories");
                setQuery("");
                setLimit(9);
              }}
            >
              Explore all stories <ArrowRight size={16} />
            </button>
          ) : (
            <Link href="/wedding-cards" className={styles.secondaryButton}>
              Explore wedding cards <ArrowRight size={16} />
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
