import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeContext";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  variant?: "icon" | "pill";
  className?: string;
}

export function ThemeToggle({ variant = "icon", className }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={(e) => toggleTheme(e)}
        className={cn(
          "flex w-full items-center justify-between rounded-full bg-surface-container px-4 py-2.5 text-xs font-medium text-foreground hover:bg-surface-container-high transition-colors cursor-pointer border-0 active:scale-[0.99]",
          className,
        )}
        aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      >
        <div className="flex items-center gap-2.5">
          {isDark ? (
            <Sun className="size-4 text-warm" />
          ) : (
            <Moon className="size-4 text-foreground/80" />
          )}
          <span>{isDark ? "Light mode" : "Dark mode"}</span>
        </div>
        <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {resolvedTheme}
        </span>
      </button>
    );
  }

  return (
    <div className="relative group/theme inline-flex items-center">
      <button
        type="button"
        onClick={(e) => toggleTheme(e)}
        className={cn(
          "inline-flex items-center justify-center p-1 text-muted-foreground hover:text-foreground bg-transparent border-0 cursor-pointer transition-colors active:scale-90 transform-gpu outline-none",
          className,
        )}
        aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      >
        {isDark ? (
          <Sun className="size-5 text-warm transition-transform duration-200 rotate-0 hover:rotate-45" />
        ) : (
          <Moon className="size-5 text-foreground transition-transform duration-200 rotate-0 hover:-rotate-12" />
        )}
      </button>
      <div className="pointer-events-none absolute top-full right-0 mt-2 z-50 opacity-0 group-hover/theme:opacity-100 transition-all duration-150 transform scale-95 group-hover/theme:scale-100 whitespace-nowrap rounded-full bg-surface-container-lowest text-foreground border border-outline-variant/40 px-3 py-1 text-xs shadow-md select-none">
        {isDark ? "Light mode" : "Dark mode"}
      </div>
    </div>
  );
}
