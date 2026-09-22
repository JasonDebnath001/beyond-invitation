"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Bold,
  Check,
  ChevronDown,
  Code,
  Eye,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  LoaderCircle,
  Minus,
  Pencil,
  Quote,
  Save,
  UploadCloud,
  X,
} from "lucide-react";
import {
  BLOG_CATEGORIES,
  blogSlug,
  parseBlogInput,
  readingMinutes,
  safeBlogImage,
  type BlogInput,
  type BlogPost,
  type BlogStatus,
} from "@/lib/blog";
import { blogRequest } from "@/lib/admin/blog-client";
import { prepareProductPhoto } from "@/lib/admin/item-photo-client";
import BlogMarkdown from "@/components/blog/BlogMarkdown";
import BlogImage from "@/components/blog/BlogImage";
import BlogAdminShell from "./BlogAdminShell";
import styles from "./BlogAdmin.module.css";

const emptyInput: BlogInput = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  category: "Wedding inspiration",
  author: "",
  cover_image: "",
  cover_alt: "",
  featured: false,
  status: "draft",
};
function asInput(post: BlogPost): BlogInput {
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    category: post.category,
    author: post.author,
    cover_image: post.cover_image,
    cover_alt: post.cover_alt,
    featured: post.featured,
    status: post.status,
  };
}

export default function BlogEditor({ id }: { id?: string }) {
  const [input, setInput] = useState<BlogInput>({ ...emptyInput });
  const [saved, setSaved] = useState<BlogPost | null>(null);
  const [baseline, setBaseline] = useState(JSON.stringify(emptyInput));
  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"cover" | "inline" | null>(null);
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [customSlug, setCustomSlug] = useState(!!id);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaAlt, setMediaAlt] = useState("");
  const [mediaError, setMediaError] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const authorInput = useRef<HTMLInputElement>(null);
  const selection = useRef({ start: 0, end: 0 });
  const creationId = useRef("");
  const activeRequest = useRef<AbortController | null>(null);
  const saveLock = useRef(false);
  const busy = saving || !!uploading;
  const dirty = JSON.stringify(input) !== baseline;

  const load = useCallback(
    async (signal: AbortSignal) => {
      if (!id) return;
      setLoading(true);
      setLoadError("");
      try {
        const { post } = await blogRequest<{ post: BlogPost }>(
          `/api/admin/blogs?id=${encodeURIComponent(id)}`,
          { signal },
        );
        if (signal.aborted) return;
        const values = asInput(post);
        setInput(values);
        setSaved(post);
        setBaseline(JSON.stringify(values));
      } catch (error) {
        if (!signal.aborted) setLoadError((error as Error).message);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [id],
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  useEffect(() => () => activeRequest.current?.abort(), []);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty || busy) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty, busy]);
  function update<K extends keyof BlogInput>(key: K, value: BlogInput[K]) {
    setInput((previous) => ({ ...previous, [key]: value }));
    setSuccess("");
    setConfirmPublish(false);
  }
  function insert(before: string, after = "", placeholder = "") {
    const { start, end } = selection.current;
    const selected = input.content.slice(start, end) || placeholder;
    const replacement = before + selected + after;
    update(
      "content",
      input.content.slice(0, start) + replacement + input.content.slice(end),
    );
    setMode("write");
    requestAnimationFrame(() => {
      textarea.current?.focus();
      textarea.current?.setSelectionRange(
        start + before.length,
        start + before.length + selected.length,
      );
      selection.current = {
        start: start + before.length,
        end: start + before.length + selected.length,
      };
    });
  }
  async function upload(file: File, target: "cover" | "inline") {
    if (busy || saveLock.current) return;
    setUploading(target);
    setError("");
    setMediaError("");
    setSuccess("");
    const controller = new AbortController();
    activeRequest.current = controller;
    try {
      const prepared = await prepareProductPhoto(file, controller.signal);
      const form = new FormData();
      form.set("image", prepared);
      const { url } = await blogRequest<{ url: string }>(
        "/api/admin/blogs/images",
        { method: "POST", body: form, signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      if (target === "cover") update("cover_image", url);
      else setMediaUrl(url);
    } catch (error) {
      if (!controller.signal.aborted)
        (target === "inline" ? setMediaError : setError)(
          (error as Error).message,
        );
    } finally {
      if (!controller.signal.aborted) setUploading(null);
    }
  }
  async function save(status: BlogStatus) {
    if (busy || saveLock.current || loading || loadError) return;
    setError("");
    setSuccess("");
    let values: BlogInput;
    try {
      values = parseBlogInput({ ...input, status });
    } catch (error) {
      setError((error as Error).message);
      if (!input.title.trim()) titleInput.current?.focus();
      else if (!input.author.trim()) authorInput.current?.focus();
      return;
    }
    saveLock.current = true;
    setSaving(true);
    setConfirmPublish(false);
    const controller = new AbortController();
    activeRequest.current = controller;
    if (!creationId.current) creationId.current = crypto.randomUUID();
    try {
      const { post } = await blogRequest<{ post: BlogPost }>(
        "/api/admin/blogs",
        {
          method: saved ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            ...values,
            id: saved?.id || creationId.current,
            expectedUpdatedAt: saved?.updated_at,
          }),
        },
      );
      if (controller.signal.aborted) return;
      const next = asInput(post);
      setSaved(post);
      setInput(next);
      setBaseline(JSON.stringify(next));
      setCustomSlug(true);
      if (!saved)
        window.history.replaceState(null, "", `/admin/blogs/${post.id}`);
      setSuccess(
        status === "published"
          ? "Your article is published and live in the journal."
          : "Draft saved. It is only visible in admin.",
      );
    } catch (error) {
      if (!controller.signal.aborted) setError((error as Error).message);
    } finally {
      saveLock.current = false;
      if (!controller.signal.aborted) setSaving(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void save(saved?.status || "draft");
  }
  function leave(event: React.MouseEvent<HTMLAnchorElement>) {
    if (
      (dirty || busy) &&
      !window.confirm(
        "Leave this editor? Changes since your last save will be lost.",
      )
    )
      event.preventDefault();
  }
  const tools = [
    {
      label: "Heading",
      icon: Heading2,
      before: "\n## ",
      after: "\n",
      placeholder: "Your heading",
    },
    {
      label: "Bold",
      icon: Bold,
      before: "**",
      after: "**",
      placeholder: "bold text",
    },
    {
      label: "Italic",
      icon: Italic,
      before: "*",
      after: "*",
      placeholder: "italic text",
    },
    {
      label: "Quote",
      icon: Quote,
      before: "\n> ",
      after: "\n",
      placeholder: "A thought worth sharing",
    },
    {
      label: "Bulleted list",
      icon: List,
      before: "\n- ",
      after: "\n",
      placeholder: "List item",
    },
    {
      label: "Numbered list",
      icon: ListOrdered,
      before: "\n1. ",
      after: "\n",
      placeholder: "First step",
    },
    {
      label: "Link",
      icon: Link2,
      before: "[",
      after: "](https://example.com)",
      placeholder: "link text",
    },
    {
      label: "Divider",
      icon: Minus,
      before: "\n\n---\n\n",
      after: "",
      placeholder: "",
    },
  ];
  return (
    <BlogAdminShell editor dirty={dirty || busy}>
      <Link href="/admin/blogs" onClick={leave} className={styles.back}>
        <ArrowLeft size={15} />
        All articles
      </Link>
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>THE JOURNAL STUDIO</span>
          <h1>{saved || id ? "Edit your story" : "A new story begins"}</h1>
          <p>Shape your ideas into something worth sharing.</p>
        </div>
        <span
          className={`${styles.badge} ${saved?.status === "published" ? styles.published : styles.draft}`}
        >
          {saved?.status === "published" ? "Published" : "Draft"}
        </span>
      </div>
      {loading ? (
        <div className={styles.empty} role="status">
          <LoaderCircle size={25} className={styles.spin} />
          <p>Opening your article…</p>
        </div>
      ) : loadError ? (
        <div className={styles.empty} role="alert">
          <h2>Couldn’t open this article</h2>
          <p>{loadError}</p>
          <button
            className={styles.secondary}
            onClick={() => {
              const controller = new AbortController();
              activeRequest.current = controller;
              void load(controller.signal);
            }}
          >
            Retry
          </button>
        </div>
      ) : (
        <form
          onSubmit={submit}
          noValidate
          onKeyDown={(event) => {
            if (
              (event.ctrlKey || event.metaKey) &&
              event.key.toLowerCase() === "s"
            ) {
              event.preventDefault();
              void save(saved?.status || "draft");
            }
          }}
        >
          <div className={styles.actionbar}>
            <span className={styles.saveState}>
              {busy ? (
                <>
                  <LoaderCircle size={15} className={styles.spin} />
                  {uploading
                    ? "Preparing and uploading image…"
                    : "Saving your story…"}
                </>
              ) : dirty ? (
                <>
                  <span className={styles.unsavedDot} />
                  Unsaved changes
                </>
              ) : saved ? (
                <>
                  <Check size={15} />
                  All changes saved
                </>
              ) : (
                "Start with a title. Make it yours."
              )}
            </span>
            <div className={styles.actions}>
              <button
                className={styles.secondary}
                type="button"
                onClick={() =>
                  setMode(mode === "preview" ? "write" : "preview")
                }
              >
                <Eye size={15} />
                {mode === "preview" ? "Back to writing" : "Preview"}
              </button>
              <button
                className={styles.secondary}
                type="submit"
                disabled={busy}
              >
                <Save size={15} />
                {saved?.status === "published" ? "Save changes" : "Save draft"}
              </button>
              {saved?.status !== "published" && (
                <button
                  className={styles.primary}
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmPublish(true)}
                >
                  Publish article <ArrowUpRight size={16} />
                </button>
              )}
            </div>
          </div>
          {error && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}
          {success && (
            <div className={styles.success} role="status">
              <Check size={17} />
              {success}
              {saved?.status === "published" && (
                <a
                  href={`/blog/${saved.slug}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View article <ArrowUpRight size={14} />
                </a>
              )}
            </div>
          )}
          {confirmPublish && (
            <div className={styles.publishConfirm}>
              <div>
                <strong>Ready to share this story?</strong>
                <p>
                  Publishing makes this article visible to everyone in the
                  journal.
                </p>
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => setConfirmPublish(false)}
                >
                  Keep writing
                </button>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={busy}
                  onClick={() => void save("published")}
                >
                  Publish now <ArrowUpRight size={15} />
                </button>
              </div>
            </div>
          )}
          <fieldset disabled={saving} className={styles.editorGrid}>
            <div className={styles.editorMain}>
              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <Pencil size={17} />
                  <h2>The story</h2>
                </div>
                <div className={styles.panelBody}>
                  <label className={styles.field}>
                    Article title <span className={styles.required}>*</span>
                    <input
                      ref={titleInput}
                      name="title"
                      value={input.title}
                      maxLength={180}
                      className={styles.titleInput}
                      placeholder="Give your story a beautiful beginning…"
                      onChange={(event) => {
                        const title = event.target.value;
                        setInput((previous) => ({
                          ...previous,
                          title,
                          slug: customSlug ? previous.slug : blogSlug(title),
                        }));
                        setSuccess("");
                        setConfirmPublish(false);
                      }}
                    />
                  </label>
                  <label className={styles.field}>
                    Author name <span className={styles.required}>*</span>
                    <input
                      ref={authorInput}
                      name="author"
                      value={input.author}
                      maxLength={100}
                      required
                      placeholder="Enter the author's name"
                      aria-describedby="blog-author-help"
                      onChange={(event) => update("author", event.target.value)}
                    />
                    <small id="blog-author-help">This name appears in the article byline and blog listing.</small>
                  </label>
                  <label className={styles.field}>
                    Short introduction
                    <textarea
                      name="excerpt"
                      rows={3}
                      maxLength={320}
                      value={input.excerpt}
                      placeholder="A few thoughtful lines to draw your reader in…"
                      onChange={(event) =>
                        update("excerpt", event.target.value)
                      }
                    />
                    <span className={styles.fieldHint}>
                      Shown on article cards and in search results.
                      <span>{input.excerpt.length}/320</span>
                    </span>
                  </label>
                </div>
              </section>
              <section className={styles.panel}>
                <div className={styles.writingHeader}>
                  <div>
                    <Code size={17} />
                    <h2>Article content</h2>
                  </div>
                  <div className={styles.modeSwitch}>
                    <button
                      type="button"
                      onClick={() => setMode("write")}
                      aria-pressed={mode === "write"}
                    >
                      Write
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("preview")}
                      aria-pressed={mode === "preview"}
                    >
                      Preview
                    </button>
                  </div>
                </div>
                {mode === "write" ? (
                  <>
                    <div
                      className={styles.formatting}
                      aria-label="Markdown formatting"
                    >
                      {tools.map((tool) => (
                        <button
                          key={tool.label}
                          type="button"
                          title={tool.label}
                          aria-label={tool.label}
                          onClick={() =>
                            insert(tool.before, tool.after, tool.placeholder)
                          }
                        >
                          <tool.icon size={17} />
                        </button>
                      ))}
                      <span />
                      <button
                        type="button"
                        title="Insert image"
                        aria-label="Insert image"
                        disabled={!!uploading}
                        onClick={() => {
                          setMediaOpen(!mediaOpen);
                          setMediaError("");
                        }}
                      >
                        <ImagePlus size={18} />
                      </button>
                    </div>
                    {mediaOpen && (
                      <div className={styles.mediaPanel}>
                        <div className={styles.mediaHeading}>
                          <strong>Add an image to your story</strong>
                          <button
                            type="button"
                            aria-label="Close image panel"
                            disabled={!!uploading}
                            onClick={() => setMediaOpen(false)}
                          >
                            <X size={17} />
                          </button>
                        </div>
                        <label className={styles.uploadInline}>
                          <UploadCloud size={16} />
                          {uploading === "inline"
                            ? "Uploading image…"
                            : "Upload an image"}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={busy}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              event.target.value = "";
                              if (file) void upload(file, "inline");
                            }}
                          />
                        </label>
                        <label className={styles.field}>
                          Or paste an image URL
                          <input
                            value={mediaUrl}
                            placeholder="https://…"
                            disabled={!!uploading}
                            onChange={(event) =>
                              setMediaUrl(event.target.value)
                            }
                          />
                        </label>
                        <label className={styles.field}>
                          Image description (alt text)
                          <input
                            value={mediaAlt}
                            maxLength={250}
                            placeholder="Describe what the image shows"
                            onChange={(event) =>
                              setMediaAlt(event.target.value)
                            }
                          />
                        </label>
                        {mediaError && (
                          <p className={styles.errorText} role="alert">
                            {mediaError}
                          </p>
                        )}
                        <button
                          className={styles.secondary}
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            if (
                              !safeBlogImage(mediaUrl.trim()) ||
                              !mediaAlt.trim()
                            ) {
                              setMediaError(
                                "Add an HTTPS image URL and a short image description.",
                              );
                              return;
                            }
                            const alt = mediaAlt
                              .trim()
                              .replace(/[\\[\]]/g, "\\$&")
                              .replace(/[\r\n]/g, " ");
                            const url = mediaUrl
                              .trim()
                              .replace(/\(/g, "%28")
                              .replace(/\)/g, "%29");
                            insert(`\n\n![${alt}](${url})\n\n`);
                            setMediaOpen(false);
                            setMediaUrl("");
                            setMediaAlt("");
                          }}
                        >
                          Insert image <ImagePlus size={15} />
                        </button>
                        <small>
                          JPG, PNG or WebP, up to 20 MB. Images are resized
                          automatically.
                        </small>
                      </div>
                    )}
                    <textarea
                      ref={textarea}
                      className={styles.markdownInput}
                      name="content"
                      aria-label="Article content in Markdown"
                      placeholder={
                        "Every celebration has a story. Start yours here…\n\n## A thoughtful detail\n\nWrite in Markdown, or use the toolbar above."
                      }
                      value={input.content}
                      maxLength={100000}
                      onChange={(event) =>
                        update("content", event.target.value)
                      }
                      onSelect={(event) => {
                        selection.current = {
                          start: event.currentTarget.selectionStart,
                          end: event.currentTarget.selectionEnd,
                        };
                      }}
                      onKeyDown={(event) => {
                        if (
                          (event.ctrlKey || event.metaKey) &&
                          ["b", "i"].includes(event.key.toLowerCase())
                        ) {
                          event.preventDefault();
                          const marker =
                            event.key.toLowerCase() === "b" ? "**" : "*";
                          insert(marker, marker, "text");
                        }
                      }}
                    />
                  </>
                ) : (
                  <div className={styles.preview}>
                    <span className={styles.eyebrow}>ARTICLE PREVIEW</span>
                    <h2>{input.title || "Your story title"}</h2>
                    {input.author.trim() && <p className={styles.previewByline}>By {input.author.trim()}</p>}
                    {input.excerpt && (
                      <p className={styles.previewExcerpt}>{input.excerpt}</p>
                    )}
                    {input.cover_image && (
                      <div className={styles.previewCover}>
                        <BlogImage
                          src={input.cover_image}
                          alt={input.cover_alt}
                        />
                      </div>
                    )}
                    {input.content ? (
                      <BlogMarkdown content={input.content} />
                    ) : (
                      <p className={styles.previewEmpty}>
                        Your story will come to life here as you write.
                      </p>
                    )}
                  </div>
                )}
                <div className={styles.editorFooter}>
                  <span>
                    {input.content.trim()
                      ? input.content
                          .trim()
                          .split(/\s+/)
                          .length.toLocaleString()
                      : 0}{" "}
                    words<span> · </span>
                    {readingMinutes(input.content)} min read
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowHelp(!showHelp)}
                    aria-expanded={showHelp}
                  >
                    Markdown guide <ChevronDown size={13} />
                  </button>
                </div>
                {showHelp && (
                  <div className={styles.markdownHelp}>
                    <p>
                      <code>## Heading</code> Section heading
                    </p>
                    <p>
                      <code>**bold**</code> Bold text
                    </p>
                    <p>
                      <code>*italic*</code> Italic text
                    </p>
                    <p>
                      <code>- Item</code> Bulleted list
                    </p>
                    <p>
                      <code>[text](https://…)</code> Link
                    </p>
                    <p>
                      <code>![description](https://…)</code> Image
                    </p>
                    <p>
                      Tables, numbered lists, quotes and task lists are
                      supported. HTML is not rendered.
                    </p>
                  </div>
                )}
              </section>
            </div>
            <aside className={styles.editorSidebar}>
              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <ImagePlus size={17} />
                  <h2>Cover image</h2>
                </div>
                <div className={styles.panelBody}>
                  {input.cover_image && safeBlogImage(input.cover_image) ? (
                    <div className={styles.coverPreview}>
                      <BlogImage
                        src={input.cover_image}
                        alt={input.cover_alt}
                      />
                      <button
                        type="button"
                        aria-label="Remove cover image"
                        disabled={!!uploading}
                        onClick={() => {
                          update("cover_image", "");
                          update("cover_alt", "");
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : null}
                  <label className={styles.coverUpload}>
                    <UploadCloud size={25} strokeWidth={1.4} />
                    <strong>
                      {uploading === "cover"
                        ? "Preparing your image…"
                        : input.cover_image
                          ? "Replace cover image"
                          : "Choose a cover image"}
                    </strong>
                    <span>JPG, PNG or WebP · Up to 20 MB</span>
                    <small>Landscape images work beautifully.</small>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={busy}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) void upload(file, "cover");
                      }}
                    />
                  </label>
                  <details className={styles.urlDetails}>
                    <summary>Use an image URL instead</summary>
                    <label className={styles.field}>
                      Image URL
                      <input
                        value={input.cover_image}
                        maxLength={2048}
                        placeholder="https://…"
                        disabled={!!uploading}
                        onChange={(event) =>
                          update("cover_image", event.target.value)
                        }
                      />
                    </label>
                  </details>
                  <label className={styles.field}>
                    Image description
                    <input
                      name="cover_alt"
                      value={input.cover_alt}
                      maxLength={250}
                      placeholder="e.g. Burgundy invitation with gold details"
                      onChange={(event) =>
                        update("cover_alt", event.target.value)
                      }
                    />
                    <small>
                      Describe the image for readers using screen readers.
                    </small>
                  </label>
                </div>
              </section>
              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <h2>Story details</h2>
                </div>
                <div className={styles.panelBody}>
                  <label className={styles.field}>
                    Category
                    <select
                      name="category"
                      value={input.category}
                      onChange={(event) =>
                        update(
                          "category",
                          event.target.value as BlogInput["category"],
                        )
                      }
                    >
                      {BLOG_CATEGORIES.map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.field}>
                    Article URL
                    <span className={styles.slugInput}>
                      <span>/blog/</span>
                      <input
                        name="slug"
                        value={input.slug}
                        maxLength={120}
                        onChange={(event) => {
                          setCustomSlug(true);
                          update("slug", event.target.value);
                        }}
                      />
                    </span>
                    <small>
                      Lowercase letters, numbers and hyphens.
                      {saved?.status === "published"
                        ? " Changing this breaks the previous article link."
                        : " Created automatically from your title."}
                    </small>
                  </label>
                  <label className={styles.featureCheck}>
                    <input
                      type="checkbox"
                      checked={input.featured}
                      onChange={(event) =>
                        update("featured", event.target.checked)
                      }
                    />
                    <span>
                      <strong>Feature this story</strong>
                      <small>
                        The newest featured story leads the journal.
                      </small>
                    </span>
                  </label>
                </div>
              </section>
              <div className={styles.writingNote}>
                <span>MAKE IT MEANINGFUL</span>
                <p>
                  A helpful idea. A beautiful detail.
                  <br />A story your readers will remember.
                </p>
              </div>
              {saved?.status === "published" && (
                <div className={styles.publishedActions}>
                  <a
                    href={`/blog/${saved.slug}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open published article <ArrowUpRight size={15} />
                  </a>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Move this article to drafts? It will no longer be visible in the journal.",
                        )
                      )
                        void save("draft");
                    }}
                  >
                    Move to drafts
                  </button>
                </div>
              )}
            </aside>
          </fieldset>
        </form>
      )}
    </BlogAdminShell>
  );
}
