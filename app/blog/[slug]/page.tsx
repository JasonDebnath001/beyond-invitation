import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Clock3 } from "lucide-react";
import { getPublishedBlog, getPublishedBlogs } from "@/lib/blog-server";
import { blogDate } from "@/lib/blog";
import { getSiteUrl } from "@/lib/site-config";
import { absoluteUrl } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import BlogMarkdown from "@/components/blog/BlogMarkdown";
import BlogImage from "@/components/blog/BlogImage";
import BlogCard from "@/components/blog/BlogCard";
import BlogShare from "@/components/blog/BlogShare";
import styles from "@/components/blog/Blog.module.css";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPublishedBlog((await params).slug);
  if (!post)
    return {
      title: "Story not found",
      robots: { index: false, follow: false },
    };
  const images = post.cover_image
    ? [{ url: absoluteUrl(post.cover_image)!, alt: post.cover_alt }]
    : undefined;
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `/blog/${post.slug}`,
      type: "article",
      publishedTime: post.published_at || undefined,
      modifiedTime: post.updated_at,
      authors: [post.author],
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images,
    },
  };
}
export default async function ArticlePage({ params }: Props) {
  const post = await getPublishedBlog((await params).slug);
  if (!post) notFound();
  const related = (await getPublishedBlogs().catch(() => []))
    .filter((item) => item.id !== post.id)
    .sort(
      (a, b) =>
        Number(b.category === post.category) -
        Number(a.category === post.category),
    )
    .slice(0, 3);
  return (
    <div className={styles.page}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          description: post.excerpt,
          image: absoluteUrl(post.cover_image),
          datePublished: post.published_at,
          dateModified: post.updated_at,
          author: {
            "@type":
              post.author === "Beyond Invitation" ? "Organization" : "Person",
            name: post.author,
          },
          publisher: {
            "@type": "Organization",
            name: "Beyond Invitation",
            logo: { "@type": "ImageObject", url: `${getSiteUrl()}/logo.png` },
          },
          mainEntityOfPage: `${getSiteUrl()}/blog/${post.slug}`,
        }}
      />
      <article className={styles.container}>
        <nav className={styles.articleBreadcrumb} aria-label="Breadcrumb">
          <Link href="/blog">
            <ArrowLeft size={15} />
            Back to the journal
          </Link>
          <span>{post.category}</span>
        </nav>
        <header className={styles.articleHeader}>
          <span className={styles.eyebrow}>{post.category}</span>
          <h1>{post.title}</h1>
          <p>{post.excerpt}</p>
          <div className={styles.articleMeta}>
            <span>By {post.author}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={post.published_at || undefined}>
              {blogDate(post.published_at)}
            </time>
            <span>
              <Clock3 size={14} />
              {post.reading_minutes} min read
            </span>
          </div>
        </header>
        {post.cover_image && (
          <div className={styles.articleCover}>
            <BlogImage src={post.cover_image} alt={post.cover_alt} priority />
          </div>
        )}
        <div className={styles.articleLayout}>
          <aside className={styles.articleAside}>
            <span className={styles.eyebrow}>A NOTE FROM OUR JOURNAL</span>
            <p>
              A little thought.
              <br />A lasting impression.
            </p>
            <span>Inspiration for celebrations that feel like you.</span>
            <Link href="/wedding-cards">
              Discover our invitations <ArrowUpRight size={15} />
            </Link>
          </aside>
          <div className={styles.articleBody}>
            <BlogMarkdown content={post.content} />
            <div className={styles.articleEnd}>
              <span>
                Written by <strong>{post.author}</strong>
              </span>
              <BlogShare />
            </div>
          </div>
        </div>
      </article>
      <div className={styles.container}>
        {!!related.length && (
          <section className={styles.related}>
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.eyebrow}>STAY A LITTLE LONGER</span>
                <h2>There’s more to be inspired by.</h2>
              </div>
              <Link href="/blog">
                All stories <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className={styles.grid}>
              {related.map((item) => (
                <BlogCard key={item.id} post={item} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
