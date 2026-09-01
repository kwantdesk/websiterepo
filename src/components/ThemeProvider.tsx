"use client";

import { useEffect } from "react";
import { applyTheme, THEME_STORAGE_KEY } from "@/lib/theme";
import { PREFERENCES_HYDRATED_EVENT } from "@/lib/userPreferences";

/**
 * Applies the stored theme, and re-applies it when the account's own arrives.
 *
 * The theme is painted before React runs, by the bootstrap script, out of THIS
 * browser's localStorage - which is what stops a wrong-coloured flash on first
 * paint. Account preferences arrive afterwards and write the account's theme
 * into that same key.
 *
 * Nothing then told the document. So signing in on a second machine restored
 * the theme into storage and left the page painted in the old one: the charts
 * changed, because the workspace re-reads its own settings on hydration, and
 * the shell around them did not. It looked like the theme had not synced when
 * it had - it just never reached the CSS variables until the next reload.
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyTheme();
    // `applyTheme` with no argument re-reads storage, so the hydrated value is
    // picked up wherever it came from.
    const reapply = () => applyTheme();
    window.addEventListener(PREFERENCES_HYDRATED_EVENT, reapply);
    /*
     * And when another tab changes it. Two windows on one machine were as out
     * of step as two machines were.
     */
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === THEME_STORAGE_KEY) reapply();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PREFERENCES_HYDRATED_EVENT, reapply);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return <>{children}</>;
}
