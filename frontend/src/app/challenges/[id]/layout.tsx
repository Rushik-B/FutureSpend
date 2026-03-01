import { ReactNode } from "react";

/** Pre-render these challenge ids for static export (e.g. GitHub Pages). */
export function generateStaticParams() {
  return [{ id: "1" }, { id: "2" }, { id: "3" }];
}

export default function ChallengeIdLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
