"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { APP_CACHE_BUST } from "../lib/build-meta";

export function VersionQuerySync() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    const currentVersion = url.searchParams.get("v");
    if (currentVersion === APP_CACHE_BUST) {
      return;
    }

    url.searchParams.set("v", APP_CACHE_BUST);
    const nextUrl = `${url.pathname}?${url.searchParams.toString()}${url.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [pathname]);

  return null;
}
