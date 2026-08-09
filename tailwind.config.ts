import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"]
      },
      colors: {
        ink: "#050B16",
        navy: "#07101D",
        "navy-2": "#0B1220",
        line: "rgba(30, 42, 61, 0.14)",
        accord: {
          ink: "#050B16",
          night: "#07101D",
          navy: "#0B1220",
          elevated: "#101A2D",
          primary: "#625BFF",
          blue: "#4F6BFF",
          violet: "#8B7CFF",
          mist: "#F6F8FC",
          panel: "var(--accord-panel)",
          surface: "var(--accord-surface)",
          faint: "var(--accord-faint)",
          tint: "var(--accord-tint)",
          border: "var(--accord-border)",
          darkBorder: "#1E2A3D",
          text: "var(--accord-text)",
          muted: "var(--accord-muted)"
        }
      },
      boxShadow: {
        "accord-soft": "0 18px 50px rgba(7, 18, 37, 0.08)",
        "accord-panel": "0 1px 1px rgba(7, 18, 37, 0.04), 0 12px 32px rgba(7, 18, 37, 0.06)",
        "accord-glow": "0 0 0 1px rgba(98, 91, 255, 0.18), 0 18px 60px rgba(79, 107, 255, 0.16)"
      }
    }
  },
  plugins: []
};

export default config;
