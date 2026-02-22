import { useState, useEffect, useCallback } from "react";

export type ColorMode = "dark" | "light";
export type LightVariant = "clean" | "slate" | "cream" | "contrast" | "noir" | "royal" | "executive" | "navy";

const LIGHT_CLASSES = [
  "light", "light-clean", "light-slate", "light-cream", "light-contrast",
  "light-noir", "light-royal", "light-executive", "light-navy",
] as const;

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

function applyLightVariant(variant: LightVariant) {
  const root = document.documentElement;
  LIGHT_CLASSES.forEach((c) => root.classList.remove(c));
  root.classList.add("light");
  if (variant !== "clean") {
    root.classList.add(`light-${variant}`);
  }
}

export const LIGHT_VARIANT_OPTIONS: { key: LightVariant; label: string; desc: string }[] = [
  { key: "clean", label: "Branco Limpo", desc: "Fundo branco puro, moderno" },
  { key: "slate", label: "Cinza Azulado", desc: "Tom azulado elegante" },
  { key: "cream", label: "Creme Premium", desc: "Tom quente e acolhedor" },
  { key: "contrast", label: "Contraste Alto", desc: "Preto no branco, máxima legibilidade" },
  { key: "noir", label: "Noir Elegante", desc: "Sidebar preta + fundo branco" },
  { key: "royal", label: "Azul Royal", desc: "Sidebar azul forte + fundo branco" },
  { key: "executive", label: "Executivo", desc: "Sidebar preta + fundo cinza suave" },
  { key: "navy", label: "Navy & Creme", desc: "Sidebar azul forte + fundo creme" },
];

export function useColorMode() {
  const [mode, setMode] = useState<ColorMode>(() => {
    const saved = localStorage.getItem("lex-color-mode");
    return (saved === "light" ? "light" : "dark") as ColorMode;
  });

  const [lightVariant, setLightVariant] = useState<LightVariant>(() => {
    return (localStorage.getItem("lex-light-variant") || "clean") as LightVariant;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (mode === "light") {
      clearInlineThemeVars();
      applyLightVariant(lightVariant);
    } else {
      LIGHT_CLASSES.forEach((c) => root.classList.remove(c));
      window.dispatchEvent(new CustomEvent("color-mode-changed", { detail: "dark" }));
    }
    localStorage.setItem("lex-color-mode", mode);
  }, [mode, lightVariant]);

  const toggle = useCallback(() => {
    setMode((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const setVariant = useCallback((v: LightVariant) => {
    setLightVariant(v);
    localStorage.setItem("lex-light-variant", v);
  }, []);

  return { mode, toggle, lightVariant, setVariant };
}
