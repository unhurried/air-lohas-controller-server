"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const REFRESH_DEBOUNCE_MS = 300;

export function RefreshOnFocus() {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const requestRefresh = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestRefresh();
      }
    };

    const handlePageShow = () => {
      requestRefresh();
    };

    window.addEventListener("focus", requestRefresh);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", requestRefresh);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [router]);

  return null;
}
