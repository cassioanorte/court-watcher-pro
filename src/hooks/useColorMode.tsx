import { useState, useEffect, useCallback } from "react";

type ColorMode = "dark" | "light";

function clearInlineThemeVars() {
  const el = document.documentElement;
  const propsToRemove = [
    "--background", "--foreground", "--card", "--card-foreground",
    "--popover", "--popover-foreground", "--primary", "--primary-foreground",
    "--secondary", "--secondary-foreground", "--muted", "--muted-foreground",
    "--accent", "--accent-foreground", "--ring", "--border", "--input",
    "--sidebar-background", "--sidebar-foreground", "--sidebar-primary",
    "--sidebar-primary-foreground", "--sidebar-accent", "--sidebar-accent-foreground",
    "--sidebar-border", "--sidebar-ring", "--gradient-primary", "--gradient-accent",
    "--gradient-hero", "--shadow-accent", "--logo-bg", "--logo-filter",
  ];
  propsToRemove.forEach((p) => el.style.removeProperty(p));
}

export function useColorMode() {
  const [mode, setMode] = useState<ColorMode>(() => {
    const saved = localStorage.getItem("lex-color-mode");
    return (saved === "light" ? "light" : "dark") as ColorMode;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (mode === "light") {
      clearInlineThemeVars();
      root.classList.add("light");
    } else {
      root.classList.remove("light");
      // Dispatch event so useThemeLoader can re-apply
      window.dispatchEvent(new CustomEvent("color-mode-changed", { detail: "dark" }));
    }
    localStorage.setItem("lex-color-mode", mode);
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  return { mode, toggle };
}
