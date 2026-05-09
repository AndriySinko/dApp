"use client";

import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      className="btn sm"
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      style={{ padding: "6px 10px", fontSize: 14, lineHeight: 1 }}
    >
      {theme === "dark" ? "○" : "●"}
    </button>
  );
}
