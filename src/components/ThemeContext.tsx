import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export interface ThemeToggleOptions {
  clientX?: number;
  clientY?: number;
}

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: (event?: React.MouseEvent | MouseEvent | ThemeToggleOptions) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "gushleads-theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stored === "light" || stored === "dark" || stored === "system") {
        return stored;
      }
    } catch {
      // ignore storage access errors
    }
    return "system";
  });

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    if (typeof window === "undefined") return "light";
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "dark") return "dark";
      if (stored === "light") return "light";
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    const root = document.documentElement;

    const computeResolved = (): ResolvedTheme => {
      if (theme === "dark") return "dark";
      if (theme === "light") return "light";
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    };

    const resolved = computeResolved();
    setResolvedTheme(resolved);

    if (resolved === "dark") {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.style.colorScheme = "light";
    }

    if (theme === "system") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => {
        const next = media.matches ? "dark" : "light";
        setResolvedTheme(next);
        if (next === "dark") {
          root.classList.add("dark");
          root.style.colorScheme = "dark";
        } else {
          root.classList.remove("dark");
          root.style.colorScheme = "light";
        }
      };
      media.addEventListener("change", handler);
      return () => {
        media.removeEventListener("change", handler);
      };
    }
    return undefined;
  }, [theme]);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
  };

  const toggleTheme = (event?: React.MouseEvent | MouseEvent | ThemeToggleOptions) => {
    const next: ResolvedTheme = resolvedTheme === "dark" ? "light" : "dark";

    const doc =
      typeof document !== "undefined"
        ? (document as unknown as {
            startViewTransition?: (cb: () => void | Promise<void>) => {
              ready: Promise<void>;
              finished: Promise<void>;
            };
          })
        : null;

    const isReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (!doc?.startViewTransition || isReducedMotion || typeof window === "undefined") {
      setTheme(next);
      return;
    }

    let x = window.innerWidth - 40;
    let y = 40;
    if (event && "clientX" in event && typeof event.clientX === "number" && event.clientX > 0) {
      x = event.clientX;
      y = typeof event.clientY === "number" && event.clientY > 0 ? event.clientY : y;
    } else {
      const btn = document.querySelector<HTMLElement>("[aria-label*='mode']");
      if (btn) {
        const rect = btn.getBoundingClientRect();
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
      }
    }

    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = doc.startViewTransition(() => {
      const root = document.documentElement;
      flushSync(() => {
        setThemeState(next);
        setResolvedTheme(next);
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          // ignore
        }
      });
      if (next === "dark") {
        root.classList.add("dark");
        root.style.colorScheme = "dark";
      } else {
        root.classList.remove("dark");
        root.style.colorScheme = "light";
      }
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 450,
          easing: "ease-in-out",
          pseudoElement: "::view-transition-new(root)",
        }
      );
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
