import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface ThemeColors {
  sidebar: string;       // sidebar background
  sidebarText: string;   // sidebar text
  accent: string;        // accent / highlight color
  background: string;    // page background
  card: string;          // card background
  foreground: string;    // main text
  logoBg?: string;       // logo background in sidebar
  logoHue?: number;      // logo hue-rotate (0-360)
  logoBrightness?: number; // logo brightness (0-200)
  logoSaturate?: number; // logo saturation (0-200)
  logoInvert?: number;   // logo invert (0-100)
}

export const DEFAULT_THEME: ThemeColors = {
  sidebar: "#1a2332",
  sidebarText: "#d4d8e0",
  accent: "#c8972e",
  background: "#f5f6f8",
  card: "#ffffff",
  foreground: "#1a2332",
  logoHue: 0,
  logoBrightness: 100,
  logoSaturate: 100,
  logoInvert: 0,
};

export function getLogoFilter(colors: ThemeColors): string {
  const h = colors.logoHue ?? 0;
  const b = colors.logoBrightness ?? 100;
  const s = colors.logoSaturate ?? 100;
  const i = colors.logoInvert ?? 0;
  return `hue-rotate(${h}deg) brightness(${b}%) saturate(${s}%) invert(${i}%)`;
}

function hexToHsl(hex: string): string {
  const c = hex.replace("#", "");
  let r = parseInt(c.substring(0, 2), 16) / 255;
  let g = parseInt(c.substring(2, 4), 16) / 255;
  let b = parseInt(c.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function darken(hex: string, amount: number): string {
  const c = hex.replace("#", "");
  const r = Math.max(0, parseInt(c.substring(0, 2), 16) - amount);
  const g = Math.max(0, parseInt(c.substring(2, 4), 16) - amount);
  const b = Math.max(0, parseInt(c.substring(4, 6), 16) - amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function lighten(hex: string, amount: number): string {
  const c = hex.replace("#", "");
  const r = Math.min(255, parseInt(c.substring(0, 2), 16) + amount);
  const g = Math.min(255, parseInt(c.substring(2, 4), 16) + amount);
  const b = Math.min(255, parseInt(c.substring(4, 6), 16) + amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function applyTheme(colors: ThemeColors) {
  const el = document.documentElement;

  // Background & foreground
  el.style.setProperty("--background", hexToHsl(colors.background));
  el.style.setProperty("--foreground", hexToHsl(colors.foreground));

  // Card
  el.style.setProperty("--card", hexToHsl(colors.card));
  el.style.setProperty("--card-foreground", hexToHsl(colors.foreground));

  // Popover
  el.style.setProperty("--popover", hexToHsl(colors.card));
  el.style.setProperty("--popover-foreground", hexToHsl(colors.foreground));

  // Accent
  const accentHsl = hexToHsl(colors.accent);
  el.style.setProperty("--accent", accentHsl);
  el.style.setProperty("--accent-foreground", hexToHsl(colors.foreground));
  el.style.setProperty("--ring", accentHsl);

  // Primary (use sidebar color as primary)
  el.style.setProperty("--primary", hexToHsl(colors.sidebar));
  el.style.setProperty("--primary-foreground", hexToHsl(colors.sidebarText));

  // Secondary & muted (derived from background)
  el.style.setProperty("--secondary", hexToHsl(darken(colors.background, 10)));
  el.style.setProperty("--secondary-foreground", hexToHsl(colors.foreground));
  el.style.setProperty("--muted", hexToHsl(darken(colors.background, 8)));
  el.style.setProperty("--muted-foreground", hexToHsl(lighten(colors.foreground, 80)));

  // Border / input
  el.style.setProperty("--border", hexToHsl(darken(colors.background, 20)));
  el.style.setProperty("--input", hexToHsl(darken(colors.background, 20)));

  // Sidebar
  el.style.setProperty("--sidebar-background", hexToHsl(colors.sidebar));
  el.style.setProperty("--sidebar-foreground", hexToHsl(colors.sidebarText));
  el.style.setProperty("--sidebar-primary", accentHsl);
  el.style.setProperty("--sidebar-primary-foreground", hexToHsl(colors.foreground));
  el.style.setProperty("--sidebar-accent", hexToHsl(lighten(colors.sidebar, 20)));
  el.style.setProperty("--sidebar-accent-foreground", hexToHsl(colors.sidebarText));
  el.style.setProperty("--sidebar-border", hexToHsl(lighten(colors.sidebar, 15)));
  el.style.setProperty("--sidebar-ring", accentHsl);

  // Gradients
  el.style.setProperty("--gradient-primary", `linear-gradient(135deg, ${colors.sidebar}, ${lighten(colors.sidebar, 25)})`);
  el.style.setProperty("--gradient-accent", `linear-gradient(135deg, ${colors.accent}, ${darken(colors.accent, 20)})`);
  el.style.setProperty("--gradient-hero", `linear-gradient(160deg, ${colors.sidebar}, ${lighten(colors.sidebar, 20)}, ${darken(colors.sidebar, 10)})`);

  // Shadows
  el.style.setProperty("--shadow-accent", `0 4px 20px hsl(${accentHsl} / 0.25)`);

  // Logo
  el.style.setProperty("--logo-bg", colors.logoBg || "");
  el.style.setProperty("--logo-filter", getLogoFilter(colors));
}

export function applyLogoOnly(colors: ThemeColors) {
  const el = document.documentElement;
  el.style.setProperty("--logo-bg", colors.logoBg || "");
  el.style.setProperty("--logo-filter", getLogoFilter(colors));
}

export function useThemeLoader() {
  const { tenantId } = useAuth();

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      const { data } = await supabase.from("tenants").select("theme_colors, primary_color").eq("id", tenantId).single();
      if (data?.theme_colors && Object.keys(data.theme_colors as object).length > 0) {
        applyTheme({ ...DEFAULT_THEME, ...(data.theme_colors as unknown as Partial<ThemeColors>) });
      } else if (data?.primary_color) {
        applyTheme({ ...DEFAULT_THEME, accent: data.primary_color });
      }
    };
    load();
  }, [tenantId]);
}
