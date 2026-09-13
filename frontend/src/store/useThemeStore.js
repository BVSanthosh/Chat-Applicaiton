import { create } from "zustand";
import { THEMES } from "../constants/index.js";

const STORAGE_KEY = "chat-theme";
const DEFAULT_THEME = "coffee";

// localStorage throws outright in Safari private mode and when a browser is set
// to block site data, which would take the whole app down at import time.
function readStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    return THEMES.includes(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export const useThemeStore = create((set) => ({
  theme: readStoredTheme(),
  setTheme: (theme) => {
    if (!THEMES.includes(theme)) {
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Preference just will not persist; not worth interrupting the user.
    }

    set({ theme });
  },
}));
