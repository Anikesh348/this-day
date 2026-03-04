export type ThemeName = "default" | "cute" | "onyx";

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentGlow: string;
  danger: string;
};

export type ThemeGradient = [string, string, string];

export const Colors: Record<ThemeName, ThemeColors> = {
  default: {
    background: "#0B0E14",
    surface: "rgba(255,255,255,0.06)",
    surfaceAlt: "rgba(255,255,255,0.1)",
    border: "rgba(255,255,255,0.12)",
    textPrimary: "#F5F7FA",
    textSecondary: "#C7CBD6",
    textMuted: "#8A90A2",
    accent: "#4F8BFF",
    accentGlow: "rgba(79,139,255,0.35)",
    danger: "#FF5C5C",
  },
  cute: {
    background: "#FFF4FB",
    surface: "#FFFFFF",
    surfaceAlt: "#FFE3F4",
    border: "#F8B9DD",
    textPrimary: "#5E2A49",
    textSecondary: "#8A4D70",
    textMuted: "#AD6D93",
    accent: "#FF6FB3",
    accentGlow: "rgba(255,111,179,0.28)",
    danger: "#FF5A7A",
  },
  onyx: {
    background: "#090806",
    surface: "#14110B",
    surfaceAlt: "#201B12",
    border: "#4A3B1E",
    textPrimary: "#F7E7C6",
    textSecondary: "#D6C39A",
    textMuted: "#A58C57",
    accent: "#E6C15A",
    accentGlow: "rgba(230,193,90,0.28)",
    danger: "#E35D5D",
  },
};

export const ThemeGradients: Record<ThemeName, ThemeGradient> = {
  default: ["#0B0E14", "#111827", "#0B0E14"],
  cute: ["#FFF4FB", "#FFE3F4", "#FFF9FD"],
  onyx: ["#090806", "#1A140A", "#090806"],
};

export const DEFAULT_THEME_NAME: ThemeName = "default";

export const THEME_OPTIONS: Array<{
  key: ThemeName;
  label: string;
  description: string;
}> = [
  {
    key: "default",
    label: "Default",
    description: "Current app look",
  },
  {
    key: "cute",
    label: "Cute",
    description: "Soft pastel mood",
  },
  {
    key: "onyx",
    label: "Onyx Gold",
    description: "Gold and black",
  },
];
