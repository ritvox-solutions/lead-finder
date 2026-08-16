export interface Palette {
  bg: string;
  bgAlt: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
  accent2: string;
  border: string;
  gradient: string;
}

const PALETTES: Record<string, Palette> = {
  food: {
    bg: "#faf6ef", bgAlt: "#f2e8da", surface: "#ffffff", text: "#241a12",
    muted: "#6b5a49", accent: "#c05621", accentSoft: "#f3e0cd", accent2: "#8a4d2f",
    border: "#e8dccb", gradient: "from-[#f2e8da] to-[#faf6ef]",
  },
  retail: {
    bg: "#f7f4fb", bgAlt: "#ece5f4", surface: "#ffffff", text: "#1d1630",
    muted: "#5f5573", accent: "#7a3ff2", accentSoft: "#e9dcfc", accent2: "#4d2a9c",
    border: "#dfd6ec", gradient: "from-[#ece5f4] to-[#f7f4fb]",
  },
  professional: {
    bg: "#f3f5f9", bgAlt: "#e7ebf3", surface: "#ffffff", text: "#121a2b",
    muted: "#5a6678", accent: "#1a56db", accentSoft: "#dbe6fb", accent2: "#0f3a8c",
    border: "#dbe1ec", gradient: "from-[#e7ebf3] to-[#f3f5f9]",
  },
  medical: {
    bg: "#f0f8f6", bgAlt: "#e0f0ec", surface: "#ffffff", text: "#0f2a26",
    muted: "#527069", accent: "#0d9488", accentSoft: "#d2ece7", accent2: "#0b6b62",
    border: "#d5e8e3", gradient: "from-[#e0f0ec] to-[#f0f8f6]",
  },
  beauty: {
    bg: "#fbf4f6", bgAlt: "#f6e6ea", surface: "#ffffff", text: "#301a22",
    muted: "#794f5c", accent: "#d64a7a", accentSoft: "#f8dfe7", accent2: "#9c2f56",
    border: "#ecd7dd", gradient: "from-[#f6e6ea] to-[#fbf4f6]",
  },
  automotive: {
    bg: "#f2f4f7", bgAlt: "#e4e8ee", surface: "#ffffff", text: "#13171d",
    muted: "#5b6672", accent: "#e05b2d", accentSoft: "#fbe2d6", accent2: "#9c3b1c",
    border: "#dbe0e7", gradient: "from-[#e4e8ee] to-[#f2f4f7]",
  },
  home: {
    bg: "#faf7f0", bgAlt: "#f0e9d8", surface: "#ffffff", text: "#27210f",
    muted: "#6f664d", accent: "#b8860b", accentSoft: "#f1e6c3", accent2: "#8a6500",
    border: "#e9e0c9", gradient: "from-[#f0e9d8] to-[#faf7f0]",
  },
  education: {
    bg: "#f5f7f9", bgAlt: "#e8edf3", surface: "#ffffff", text: "#14202d",
    muted: "#5b6b7c", accent: "#2563eb", accentSoft: "#dbe7fb", accent2: "#1d4ed8",
    border: "#dde4ec", gradient: "from-[#e8edf3] to-[#f5f7f9]",
  },
  other: {
    bg: "#f6f7f8", bgAlt: "#e9ebee", surface: "#ffffff", text: "#17181a",
    muted: "#5c5f66", accent: "#3f7c8c", accentSoft: "#deecef", accent2: "#2a5a66",
    border: "#dde1e4", gradient: "from-[#e9ebee] to-[#f6f7f8]",
  },
};

export function paletteFor(category: string): Palette {
  return PALETTES[category] ?? PALETTES.other;
}