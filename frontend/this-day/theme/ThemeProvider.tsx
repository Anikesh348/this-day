import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

import {
  Colors,
  DEFAULT_THEME_NAME,
  ThemeGradients,
  ThemeName,
} from "@/theme/colors";

const THEME_STORAGE_KEY = "this_day_theme";
const THEME_GRADIENT_STORAGE_KEY = "this_day_theme_gradient";

type ThemeContextValue = {
  themeName: ThemeName;
  colors: (typeof Colors)[ThemeName];
  gradientColors: (typeof ThemeGradients)[ThemeName];
  gradientEnabled: boolean;
  setTheme: (theme: ThemeName) => void;
  setGradientEnabled: (enabled: boolean) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemeName(value: string): value is ThemeName {
  return value === "default" || value === "cute" || value === "onyx";
}

async function readStoredTheme(): Promise<ThemeName | null> {
  try {
    const value =
      Platform.OS === "web"
        ? localStorage.getItem(THEME_STORAGE_KEY)
        : await SecureStore.getItemAsync(THEME_STORAGE_KEY);
    if (!value) return null;
    if (value === "hacker" || value === "modern") return "onyx";
    if (!isThemeName(value)) return null;
    return value;
  } catch {
    return null;
  }
}

async function writeStoredTheme(theme: ThemeName) {
  try {
    if (Platform.OS === "web") {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      return;
    }
    await SecureStore.setItemAsync(THEME_STORAGE_KEY, theme);
  } catch {
    // Best-effort only.
  }
}

async function readStoredGradientEnabled(): Promise<boolean | null> {
  try {
    const value =
      Platform.OS === "web"
        ? localStorage.getItem(THEME_GRADIENT_STORAGE_KEY)
        : await SecureStore.getItemAsync(THEME_GRADIENT_STORAGE_KEY);
    if (!value) return null;
    return value === "1";
  } catch {
    return null;
  }
}

async function writeStoredGradientEnabled(enabled: boolean) {
  const value = enabled ? "1" : "0";
  try {
    if (Platform.OS === "web") {
      localStorage.setItem(THEME_GRADIENT_STORAGE_KEY, value);
      return;
    }
    await SecureStore.setItemAsync(THEME_GRADIENT_STORAGE_KEY, value);
  } catch {
    // Best-effort only.
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>(DEFAULT_THEME_NAME);
  const [gradientEnabled, setGradientEnabledState] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadThemeSettings = async () => {
      const [storedTheme, storedGradientEnabled] = await Promise.all([
        readStoredTheme(),
        readStoredGradientEnabled(),
      ]);

      if (!mounted) return;

      if (storedTheme) {
        setThemeName(storedTheme);
      }
      if (storedGradientEnabled !== null) {
        setGradientEnabledState(storedGradientEnabled);
      }
    };
    void loadThemeSettings();
    return () => {
      mounted = false;
    };
  }, []);

  const setTheme = useCallback((nextTheme: ThemeName) => {
    setThemeName(nextTheme);
    void writeStoredTheme(nextTheme);
  }, []);

  const setGradientEnabled = useCallback((enabled: boolean) => {
    setGradientEnabledState(enabled);
    void writeStoredGradientEnabled(enabled);
  }, []);

  const value = useMemo(
    () => ({
      themeName,
      colors: Colors[themeName],
      gradientColors: ThemeGradients[themeName],
      gradientEnabled,
      setTheme,
      setGradientEnabled,
    }),
    [gradientEnabled, setGradientEnabled, setTheme, themeName],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
