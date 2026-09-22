"use client";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, ArrowUpRight, LayoutGrid, PenLine } from "lucide-react";
import type { ReactNode, MouseEvent } from "react";
import styles from "./ItemDashboard.module.css";
import blogStyles from "./BlogAdmin.module.css";

export default function BlogAdminShell({
  children,
  editor = false,
  dirty = false,
}: {
  children: ReactNode;
  editor?: boolean;
  dirty?: boolean;
}) {
  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    if (
      dirty &&
      !window.confirm(
        "Leave this editor? Changes since your last save will be lost.",
      )
    )
      event.preventDefault();
  }
  return (
    <div className={`${styles.app} ${blogStyles.app}`}>
      <aside className={styles.sidebar}>
        <a href="/admin" className={styles.brand} onClick={navigate}>
          <Image
            src="/logo.png"
            alt=""
            width={44}
            height={44}
            className={styles.brandMark}
          />
          <span>
            Beyond Invitation<small>ADMIN WORKSPACE</small>
          </span>
        </a>
        <div className={styles.sidebarLabel}>WORKSPACE</div>
        <a href="/admin" className={styles.navButton} onClick={navigate}>
          <LayoutGrid size={18} />
          All items
        </a>
        <Link
          href="/admin/blogs"
          className={styles.navActive}
          aria-current={editor ? undefined : "page"}
          onClick={navigate}
        >
          <BookOpen size={18} />
          Blogs
        </Link>
        <div className={styles.sidebarNote}>
          <PenLine size={19} />
          <p>
            Ideas, inspiration and stories.
            <br />
            Make every word feel like you.
          </p>
        </div>
        <div className={styles.adminLabel}>
          ADMIN WORKSPACE <span>/admin</span>
        </div>
      </aside>
      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <span>
            Workspace <span className={styles.slash}>/</span>{" "}
            <strong>{editor ? "Blog editor" : "Blogs"}</strong>
          </span>
          <a
            className={blogStyles.publicLink}
            href="/blog"
            target="_blank"
            rel="noreferrer"
          >
            View journal <ArrowUpRight size={15} />
          </a>
        </header>
        <main className={`${styles.content} ${blogStyles.content}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
