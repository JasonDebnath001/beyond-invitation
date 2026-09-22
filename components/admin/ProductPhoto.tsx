"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import styles from "./ItemDashboard.module.css";

export default function ProductPhoto({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState<string>();
  const valid = src && /^(https?:\/\/|blob:|\/)/.test(src);
  if (!valid || failed === src) return <span className={styles.noPhoto}><ImageOff size={22} /><span>{src ? "Photo unavailable" : "No main photo"}</span></span>;
  return <Image src={src} alt={alt} width={180} height={180} unoptimized className={styles.photoImage} onError={() => setFailed(src)} />;
}
