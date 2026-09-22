import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { safeBlogImage } from "@/lib/blog";
import styles from "./Blog.module.css";

export default function BlogMarkdown({ content }: { content: string }) {
  return (
    <div className={styles.prose}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={(url, key) =>
          key === "src"
            ? safeBlogImage(url)
              ? url
              : ""
            : defaultUrlTransform(url)
        }
        components={{
          h1: ({ children }) => <h2>{children}</h2>,
          a: ({ href, children }) => (
            <a href={href} rel="noreferrer noopener">
              {children}
            </a>
          ),
          img: ({ src, alt, title }) =>
            typeof src === "string" && safeBlogImage(src) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={alt || ""}
                title={title}
                loading="lazy"
                decoding="async"
              />
            ) : null,
          table: ({ children }) => (
            <div className={styles.tableScroll}>
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}
