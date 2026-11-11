"use client";

import { useEffect, useState } from "react";
import { trackingTokenFromHash } from "@/lib/order-tracking-link";

export function usePrivateTrackingToken() {
  const [value, setValue] = useState<{ ready: boolean; token: string | null }>({ ready: false, token: null });
  useEffect(() => {
    const read = () => setValue({ ready: true, token: trackingTokenFromHash(window.location.hash) });
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  return value;
}
