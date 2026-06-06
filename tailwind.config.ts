import type { Config } from "tailwindcss";

export default {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "PingFang SC", "Microsoft YaHei", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      colors: {
        memoir: {
          primary: "var(--primary)",
          bg: "var(--bg)",
          surface: "var(--surface)",
          border: "var(--border)",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
