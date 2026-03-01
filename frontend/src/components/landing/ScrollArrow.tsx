"use client";

import { useEffect, useState } from "react";

const DELAY_MS = 2000;
const SCROLL_OFFSET = 10;

export function ScrollArrow({ targetId }: { targetId: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reducedMotion ? 0 : DELAY_MS;

    const t = delay > 0 ? setTimeout(() => setVisible(true), delay) : null;
    if (delay === 0) setVisible(true);
    return () => { if (t) clearTimeout(t); };
  }, []);

  const scrollToTarget = () => {
    const target = document.getElementById(targetId);
    if (!target) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const y = target.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: Math.max(0, y - SCROLL_OFFSET),
      behavior: reducedMotion ? "auto" : "smooth",
    });
  };

  return (
    <button
      type="button"
      onClick={scrollToTarget}
      aria-label="Scroll to content"
      title="Scroll to content"
      className={`absolute bottom-6 left-1/2 z-20 flex h-11 min-h-[44px] w-11 min-w-[44px] -translate-x-1/2 items-center justify-center rounded border-none bg-transparent p-0 text-white/50 transition-[opacity,color] duration-200 hover:text-white/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
        visible ? "pointer-events-auto opacity-60" : "pointer-events-none opacity-0"
      }`}
      style={{ transition: "opacity 0.4s ease, color 0.2s ease" }}
    >
      {/* CSS triangle down (same as personal site) */}
      <span
        className="block mt-0.5 h-0 w-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-current"
        aria-hidden
      />
    </button>
  );
}
