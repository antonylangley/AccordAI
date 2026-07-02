import type { Config } from "tailwindcss";

const config: Config = {
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
          night: "#070C16",
          navy: "#0B1220",
          elevated: "#101A2D",
          primary: "#625BFF",
          blue: "#4F6BFF",
          violet: "#8B7CFF",
          mist: "#F5F6FA",
          surface: "#FFFFFF",
          border: "#E7EAF1",
          hairline: "#ECEEF4",
          darkBorder: "#18212F",
          text: "#0A1120",
          muted: "#667085"
        }
      },
      boxShadow: {
        "accord-soft": "0 12px 40px rgba(10, 17, 32, 0.08)",
        "accord-panel": "0 1px 2px rgba(10, 17, 32, 0.04)",
        "accord-glow": "0 0 0 1px rgba(98, 91, 255, 0.16), 0 12px 40px rgba(79, 107, 255, 0.14)"
      }
    }
  },
  plugins: []
};

export default config;
