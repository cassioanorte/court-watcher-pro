/**
 * Extract dominant colors from an image URL using canvas.
 * Returns an array of hex color strings sorted by frequency.
 */
export async function extractColorsFromImage(imageUrl: string, maxColors = 6): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const size = 100; // downsample for speed
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve([]);

        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;

        // Bucket colors by rounding to nearest 16
        const buckets = new Map<string, number>();
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 128) continue; // skip transparent pixels

          // Round to reduce noise
          const rr = Math.round(r / 16) * 16;
          const gg = Math.round(g / 16) * 16;
          const bb = Math.round(b / 16) * 16;

          // Skip near-white and near-black (they're not useful theme colors)
          const lum = 0.299 * rr + 0.587 * gg + 0.114 * bb;
          if (lum > 240 || lum < 15) continue;

          const key = `#${rr.toString(16).padStart(2, "0")}${gg.toString(16).padStart(2, "0")}${bb.toString(16).padStart(2, "0")}`;
          buckets.set(key, (buckets.get(key) || 0) + 1);
        }

        // Sort by frequency
        const sorted = [...buckets.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([hex]) => hex);

        // Deduplicate similar colors (distance < 60)
        const unique: string[] = [];
        for (const hex of sorted) {
          if (unique.length >= maxColors) break;
          const rgb = hexToRgb(hex);
          const tooClose = unique.some((u) => {
            const other = hexToRgb(u);
            return colorDistance(rgb, other) < 60;
          });
          if (!tooClose) unique.push(hex);
        }

        resolve(unique.length > 0 ? unique : ["#c8972e"]); // fallback
      } catch {
        resolve(["#c8972e"]);
      }
    };
    img.onerror = () => reject(new Error("Falha ao carregar imagem"));
    img.src = imageUrl;
  });
}

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [
    parseInt(c.substring(0, 2), 16),
    parseInt(c.substring(2, 4), 16),
    parseInt(c.substring(4, 6), 16),
  ];
}

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function darkenHex(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `#${Math.max(0, r - amount).toString(16).padStart(2, "0")}${Math.max(0, g - amount).toString(16).padStart(2, "0")}${Math.max(0, b - amount).toString(16).padStart(2, "0")}`;
}

function lightenHex(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `#${Math.min(255, r + amount).toString(16).padStart(2, "0")}${Math.min(255, g + amount).toString(16).padStart(2, "0")}${Math.min(255, b + amount).toString(16).padStart(2, "0")}`;
}

/**
 * Generate 3 theme presets from an array of extracted colors.
 */
export function generateThemePresetsFromColors(
  colors: string[]
): { label: string; colors: { sidebar: string; sidebarText: string; accent: string; background: string; card: string; foreground: string } }[] {
  const primary = colors[0] || "#c8972e";
  const secondary = colors[1] || darkenHex(primary, 40);
  const tertiary = colors[2] || lightenHex(primary, 40);

  return [
    {
      label: "Clássico do Logo",
      colors: {
        sidebar: darkenHex(primary, 80),
        sidebarText: lightenHex(primary, 140),
        accent: primary,
        background: "#f5f6f8",
        card: "#ffffff",
        foreground: darkenHex(primary, 100),
      },
    },
    {
      label: "Vibrante do Logo",
      colors: {
        sidebar: darkenHex(secondary, 60),
        sidebarText: lightenHex(secondary, 140),
        accent: secondary.length > 1 ? secondary : primary,
        background: lightenHex(primary, 170),
        card: "#ffffff",
        foreground: darkenHex(secondary, 80),
      },
    },
    {
      label: "Escuro do Logo",
      colors: {
        sidebar: darkenHex(primary, 110),
        sidebarText: lightenHex(tertiary, 100),
        accent: tertiary.length > 1 ? tertiary : primary,
        background: darkenHex(primary, 100),
        card: darkenHex(primary, 85),
        foreground: lightenHex(primary, 160),
      },
    },
  ];
}
