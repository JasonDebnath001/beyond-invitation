"use client";
import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import styles from "./Blog.module.css";

export default function BlogShare() {
  const [message, setMessage] = useState("");
  return <div className={styles.share}><button type="button" onClick={async () => {
    try { await navigator.clipboard.writeText(window.location.href); setMessage("Link copied"); }
    catch { setMessage("Copy the link from your address bar to share this story."); }
  }}>{message === "Link copied" ? <Check size={16} /> : <Link2 size={16} />} Share this story</button><span role="status">{message}</span></div>;
}
