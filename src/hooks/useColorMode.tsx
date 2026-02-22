import { useState, useEffect, useCallback } from "react";

type ColorMode = "dark" | "light";

export function useColorMode() {
  const [mode, setMode] = useState<ColorMode>(() => {
    const saved = localStorage.getItem("lex-color-mode");
    return (saved === "light" ? "light" : "dark") as ColorMode;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (mode === "light") {
      root.classList.add("light");
    } else {
      root.classList.remove("light");
    }
    localStorage.setItem("lex-color-mode", mode);
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  return { mode, toggle };
}
