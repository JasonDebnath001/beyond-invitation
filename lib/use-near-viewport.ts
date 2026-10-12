"use client";

import { useEffect, useRef, useState } from "react";

/** Start optional network work once a section approaches the viewport. */
export function useNearViewport<T extends HTMLElement>(rootMargin = "300px") {
  const ref = useRef<T | null>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);

  useEffect(() => {
    if (isNearViewport || !ref.current) return;
    if (typeof window.IntersectionObserver !== "function") {
      setIsNearViewport(true);
      return;
    }

    let active = true;
    const observer = new window.IntersectionObserver((entries) => {
      if (active && entries.some((entry) => entry.isIntersecting)) {
        setIsNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin });
    observer.observe(ref.current);

    return () => {
      active = false;
      observer.disconnect();
    };
  }, [isNearViewport, rootMargin]);

  return [ref, isNearViewport] as const;
}
