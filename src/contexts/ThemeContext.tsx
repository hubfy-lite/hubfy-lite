import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";

// ─── Types ───────────────────────────────────────────────────────────────────
export type Theme = "dark" | "light";

interface ThemeContextValue {
  /** Current applied theme */
  theme: Theme;
  /** Change theme. Persists to localStorage and optionally to Supabase. */
  setTheme: (next: Theme) => void;
  /** Hydrate from user's profile in Supabase. Returns when done. */
  hydrateUserTheme: (userId: string) => Promise<void>;
  /** Reset to public (pre-login) theme */
  hydratePublicTheme: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const STORAGE_KEY = "hubfy.theme";
const DEFAULT_THEME: Theme = "light";

// ─── Helpers (pure, no React) ────────────────────────────────────────────────
function readStorage(key: string): Theme | null {
  try {
    const v = localStorage.getItem(key);
    return v === "dark" || v === "light" ? v : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: Theme) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // quota / private-browsing
  }
}

function applyToDOM(theme: Theme) {
  const cl = document.documentElement.classList;
  if (theme === "dark") {
    cl.add("dark");
  } else {
    cl.remove("dark");
  }
}

/** Initial theme: read from localStorage, fallback to default */
function resolveInitialTheme(): Theme {
  return readStorage(STORAGE_KEY) ?? DEFAULT_THEME;
}

// ─── Context ─────────────────────────────────────────────────────────────────
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────────────
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // The DOM was already set by the inline script in index.html, so the initial
  // state here simply mirrors what's already visible — no flash.
  const [theme, setThemeState] = useState<Theme>(resolveInitialTheme);

  // Version guard: ignore stale async responses
  const versionRef = useRef(0);
  // Track active userId so setTheme can persist remotely
  const activeUserIdRef = useRef<string | null>(null);

  // ── setTheme (public API) ──────────────────────────────────────────────────
  const setTheme = useCallback(
    (next: Theme) => {
      const prev = theme;
      // Optimistic: apply immediately
      setThemeState(next);
      applyToDOM(next);
      writeStorage(STORAGE_KEY, next);

      const userId = activeUserIdRef.current;
      if (!userId) return; // not logged in — local-only

      // Persist to Supabase in background
      (async () => {
        try {
          // Read current preferences to merge (don't overwrite other keys)
          const { data: profile } = await supabase
            .from("profiles")
            .select("preferences")
            .eq("user_id", userId)
            .maybeSingle();

          const merged = { ...(profile?.preferences as Record<string, unknown> ?? {}), theme: next };

          const { error } = await supabase
            .from("profiles")
            .update({ preferences: merged })
            .eq("user_id", userId);

          if (error) throw error;

          // Sync react-query cache so profile.preferences.theme stays consistent
          queryClient.invalidateQueries({ queryKey: ["profile", userId] });
        } catch (err) {
          console.error("[theme] remote persist failed", err);
          // Rollback
          setThemeState(prev);
          applyToDOM(prev);
          writeStorage(STORAGE_KEY, prev);
          toast({
            variant: "destructive",
            title: t("themeError"),
            description: t("themeErrorRetry"),
          });
        }
      })();
    },
    [theme, toast, t, queryClient],
  );

  // ── hydrateUserTheme ───────────────────────────────────────────────────────
  const hydrateUserTheme = useCallback(
    async (userId: string) => {
      const ver = ++versionRef.current;
      activeUserIdRef.current = userId;

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("preferences")
          .eq("user_id", userId)
          .maybeSingle();

        if (error) {
          console.warn("[theme] hydrate fetch error", error);
          // Keep whatever localStorage says — already applied by inline script
          return;
        }

        // Guard: ignore if a newer hydration was triggered
        if (ver !== versionRef.current) return;

        const dbTheme: Theme =
          (data?.preferences as { theme?: string } | null)?.theme === "dark"
            ? "dark"
            : (data?.preferences as { theme?: string } | null)?.theme === "light"
              ? "light"
              : DEFAULT_THEME;

        setThemeState(dbTheme);
        applyToDOM(dbTheme);
        writeStorage(STORAGE_KEY, dbTheme);
      } catch (err) {
        console.warn("[theme] hydrate unexpected error", err);
      }
    },
    [],
  );

  // ── hydratePublicTheme ─────────────────────────────────────────────────────
  const hydratePublicTheme = useCallback(() => {
    activeUserIdRef.current = null;
    setThemeState(DEFAULT_THEME);
    applyToDOM(DEFAULT_THEME);
    writeStorage(STORAGE_KEY, DEFAULT_THEME);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, hydrateUserTheme, hydratePublicTheme }),
    [theme, setTheme, hydrateUserTheme, hydratePublicTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
