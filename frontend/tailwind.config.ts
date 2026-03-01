import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ── Surface system (layered dark backgrounds) ── */
        surface: {
          0: "#09090b",
          1: "#141418",
          2: "#161619",
          3: "#1c1c20",
          4: "#222226",
          5: "#2a2a2f",
          inset: "#161619",
        },

        /* ── Gray scale (inspired by Sure/Maybe) ── */
        gray: {
          25: "#FAFAFA",
          50: "#F7F7F7",
          100: "#F0F0F0",
          200: "#E7E7E7",
          300: "#CFCFCF",
          400: "#9E9E9E",
          500: "#737373",
          600: "#5C5C5C",
          700: "#363636",
          800: "#242424",
          900: "#171717",
        },

        /* ── Functional tokens ── */
        success: {
          DEFAULT: "#10A861",
          light: "#12B76A",
          muted: "rgba(16, 168, 97, 0.10)",
          strong: "#32D583",
        },
        destructive: {
          DEFAULT: "#EC2222",
          light: "#F13636",
          muted: "rgba(236, 34, 34, 0.10)",
          strong: "#ED4E4E",
        },
        warning: {
          DEFAULT: "#DC6803",
          light: "#F79009",
          muted: "rgba(247, 144, 9, 0.10)",
          strong: "#FDB022",
        },

        /* ── Accent palette ── */
        accent: {
          green: "#10A861",
          "green-muted": "rgba(16, 168, 97, 0.10)",
          red: "#EC2222",
          "red-muted": "rgba(236, 34, 34, 0.10)",
          blue: "#2E90FA",
          "blue-muted": "rgba(46, 144, 250, 0.10)",
          amber: "#F79009",
          "amber-muted": "rgba(247, 144, 9, 0.10)",
          purple: "#875BF7",
          "purple-muted": "rgba(135, 91, 247, 0.10)",
          cyan: "#06AED4",
          "cyan-muted": "rgba(6, 174, 212, 0.10)",
          indigo: "#6172F3",
          "indigo-muted": "rgba(97, 114, 243, 0.10)",
          pink: "#F23E94",
          "pink-muted": "rgba(242, 62, 148, 0.10)",
        },

        /* ── Brand ── */
        brand: {
          DEFAULT: "#e4e4e7",
          muted: "rgba(228,228,231,0.08)",
        },

        /* ── Legacy compat ── */
        primary: {
          50: "#18181b",
          100: "#232326",
          200: "#3f3f46",
          300: "#52525b",
          400: "#a1a1aa",
          500: "#d4d4d8",
          600: "#e4e4e7",
          700: "#f4f4f5",
          800: "#fafafa",
          900: "#ffffff",
        },

        app: {
          bg: "#09090b",
          surface: "#141418",
          sidebar: "#09090b",
        },
      },

      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },

      borderRadius: {
        xl: "10px",
        "2xl": "14px",
      },

      boxShadow: {
        "border-xs": "0px 1px 2px 0px rgba(0, 0, 0, 0.25)",
        "border-sm": "0px 1px 6px 0px rgba(0, 0, 0, 0.25)",
        card: "0 0 0 1px rgba(255,255,255,0.06), 0 1px 2px rgba(0,0,0,0.3)",
        "card-hover":
          "0 0 0 1px rgba(255,255,255,0.1), 0 4px 12px rgba(0,0,0,0.4)",
        glow: "0 0 20px rgba(46, 144, 250, 0.15)",
      },

      animation: {
        "fade-up": "fade-up 0.4s ease-out both",
        "slide-in": "slide-in 0.3s ease-out both",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateX(-8px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
