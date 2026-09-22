"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, BookOpen, CircleAlert, FileText, LoaderCircle, Pencil, Plus, RefreshCw, Search } from "lucide-react";
import { blogDate, type BlogSummary } from "@/lib/blog";
import { blogRequest } from "@/lib/admin/blog-client";
import BlogImage from "@/components/blog/BlogImage";
import BlogAdminShell from "./BlogAdminShell";
import styles from "./BlogAdmin.module.css";

export default function BlogDashboard() {
  const [posts, setPosts] = useState<BlogSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [limit, setLimit] = useState(20);
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    setLoading(true); setError("");
    try { const data = await blogRequest<{ posts: BlogSummary[] }>("/api/admin/blogs", { signal: request.signal }); if (!request.signal.aborted) setPosts(data.posts); }
    catch (error) { if (!request.signal.aborted) setError((error as Error).message); }
    finally { if (!request.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => { void load(); return () => controller.current?.abort(); }, [load]);
  const results = useMemo(() => posts.filter(post => (status === "all" || post.status === status) && `${post.title} ${post.category} ${post.author}`.toLowerCase().includes(query.trim().toLowerCase())), [posts, status, query]);
  const published = posts.filter(post => post.status === "published").length;
  return <BlogAdminShell>
    <div className={styles.heading}><div><span className={styles.eyebrow}>YOUR BRAND, IN WORDS</span><h1>The journal</h1><p>A home for your ideas, inspiration and stories.</p></div><Link href="/admin/blogs/new" className={styles.primary}><Plus size={17} />Add blog</Link></div>
    <div className={styles.stats}><div><BookOpen size={20} /><span>All articles<strong>{loading ? "—" : posts.length}</strong></span></div><div><ArrowUpRight size={20} /><span>Published<strong>{loading ? "—" : published}</strong></span></div><div><FileText size={20} /><span>Drafts<strong>{loading ? "—" : posts.length - published}</strong></span></div></div>
    <section className={styles.library} aria-label="Blog library"><div className={styles.libraryToolbar}><div className={styles.tabs}>{["all", "published", "draft"].map(value => <button key={value} onClick={() => { setStatus(value); setLimit(20); }} aria-pressed={status === value} className={status === value ? styles.activeTab : ""}>{value === "all" ? "All articles" : value === "draft" ? "Drafts" : "Published"}</button>)}</div><div className={styles.librarySearch}><Search size={16} /><input type="search" aria-label="Search articles" placeholder="Search articles…" value={query} onChange={event => { setQuery(event.target.value); setLimit(20); }} /><button onClick={() => void load()} disabled={loading} aria-label="Refresh articles"><RefreshCw size={16} /></button></div></div>
      {error ? <div className={styles.empty} role="alert"><CircleAlert size={28} /><h2>We couldn’t load your articles</h2><p>{error}</p><button className={styles.secondary} onClick={() => void load()}>Retry</button></div> : loading ? <div className={styles.empty} role="status"><LoaderCircle className={styles.spin} size={25} /><p>Opening the journal…</p></div> : !results.length ? <div className={styles.empty}><div className={styles.emptyIcon}><PenIcon /></div><span className={styles.eyebrow}>{posts.length ? "NO MATCHING ARTICLES" : "EVERY STORY STARTS SOMEWHERE"}</span><h2>{posts.length ? "Try a different search." : "Write your first chapter."}</h2><p>{posts.length ? "Adjust the filters to find your article." : "Share an idea, a tradition or a glimpse behind the craft. Save a draft and publish when you’re ready."}</p>{!posts.length && <Link href="/admin/blogs/new" className={styles.primary}><Plus size={16} />Create your first blog</Link>}</div> : <><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Article</th><th>Status</th><th>Category</th><th>Last updated</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{results.slice(0, limit).map(post => <tr key={post.id}><td><Link className={styles.articleCell} href={`/admin/blogs/${post.id}`}><div className={styles.thumb}><BlogImage src={post.cover_image} alt="" /></div><span><strong>{post.title}</strong><small>{post.author}{post.featured ? " · Featured" : ""}</small></span></Link></td><td><span className={`${styles.badge} ${post.status === "published" ? styles.published : styles.draft}`}>{post.status === "published" ? "Published" : "Draft"}</span></td><td>{post.category}</td><td>{blogDate(post.updated_at)}</td><td><Link className={styles.editLink} href={`/admin/blogs/${post.id}`} aria-label={`Edit ${post.title}`}><Pencil size={15} />Edit</Link></td></tr>)}</tbody></table></div><div className={styles.libraryFooter}><span>{Math.min(results.length, limit)} of {results.length} articles</span>{results.length > limit && <button className={styles.secondary} onClick={() => setLimit(value => value + 20)}>Load more</button>}</div></>}
    </section>
  </BlogAdminShell>;
}
function PenIcon() { return <Pencil size={26} strokeWidth={1.2} />; }
