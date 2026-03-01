"use client";

import { useEffect, useState } from "react";

const SESSION_KEY = "futureSpend_heroSeen_v2";
/** Total time until all hero animations finish: box draw + bg in + grow */
const ANIMATION_TOTAL_MS = 5000;

export function HeroLockup({ children }: { children: React.ReactNode }) {
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const alreadySeen = sessionStorage.getItem(SESSION_KEY);
    setSeen(!!alreadySeen);
    if (!alreadySeen) {
      const t = setTimeout(() => {
        sessionStorage.setItem(SESSION_KEY, "1");
      }, ANIMATION_TOTAL_MS);
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <div
      className={`hero-lockup-box relative inline-flex flex-col items-center gap-4 px-8 py-6 sm:gap-5 sm:px-12 sm:py-8 ${seen === true ? "hero-lockup-seen" : ""}`}
    >
      {children}
    </div>
  );
}
