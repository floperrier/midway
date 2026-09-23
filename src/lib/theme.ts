import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";
const KEY = "theme";

function apply(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

function read(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // private mode / blocked storage — fall through to system
  }
  return "system";
}

/** Single source of truth for the theme. The `<html>` class is set pre-paint by
 *  the inline script in __root.tsx; this hook keeps React in step with it.
 *  `mounted` is false on the server and the first client render, so callers can
 *  avoid rendering theme-dependent output into a hydration mismatch. */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Reading localStorage during render would hydrate against a server pass
    // that cannot see it, so the stored theme has to land after mount.
    // oxlint-disable-next-line react/set-state-in-effect
    setThemeState(read());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    apply(theme);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => theme === "system" && apply(theme);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme, mounted]);

  function setTheme(next: Theme) {
    setThemeState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // storage blocked: theme still applies for this page load
    }
  }

  const resolved: "light" | "dark" | undefined = mounted
    ? document.documentElement.classList.contains("dark")
      ? "dark"
      : "light"
    : undefined;

  return { theme, resolvedTheme: resolved, setTheme, mounted };
}
