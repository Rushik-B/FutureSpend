"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const DARK_BG = "#020617"; // slate-950

export function HomePageBodyStyle() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isHome) {
      document.body.style.background = DARK_BG;
      return () => {
        document.body.style.background = "";
      };
    }
  }, [isHome]);

  return null;
}
