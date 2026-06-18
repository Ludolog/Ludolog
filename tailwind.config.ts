import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}", "./docs/**/*.md"],
  theme: {
    extend: {
      colors: {
        radar: {
          bg: "#070A12",
          panel: "#0D1220",
          panelSoft: "#121A2A",
          line: "#253044",
          cyan: "#32D6F6",
          green: "#6EE7A8",
          violet: "#A78BFA",
          amber: "#F6C453",
          red: "#F87171"
        }
      },
      boxShadow: {
        glow: "0 0 32px rgba(50, 214, 246, 0.14)"
      }
    }
  },
  plugins: []
};

export default config;
