export const APP_NAME = "FutureSpend";
export const TAGLINE = "Predict Tomorrow's Spending Today";

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/calendar", label: "Calendar" },
  { href: "/challenges", label: "Challenges" },
  { href: "/coach", label: "AI Coach" },
  { href: "/settings", label: "Settings" },
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  food: "#2E90FA",
  transport: "#10A861",
  social: "#F79009",
  shopping: "#875BF7",
  health: "#EC2222",
  entertainment: "#06AED4",
  work: "#6366f1",
  subscriptions: "#737373",
  other: "#9E9E9E",
};

export const RISK_COLORS = {
  LOW: "#10A861",
  MED: "#F79009",
  HIGH: "#EC2222",
} as const;

/** Shared Recharts tooltip style — dark theme, used across all chart pages. */
export const CHART_TOOLTIP_STYLE: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  background: "#1c1c20",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  color: "#e4e4e7",
};

export const SUGGESTED_PROMPTS = [
  "Why did I overspend this month?",
  "Can I afford going out this weekend?",
  "What's my biggest spending trigger?",
  "Suggest a savings goal for next month",
  "How does my spending compare to last month?",
];
