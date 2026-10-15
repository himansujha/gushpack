import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider, useTheme } from "@/components/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";

function TestConsumer() {
  const { resolvedTheme } = useTheme();
  return <div data-testid="resolved">{resolvedTheme}</div>;
}

describe("ThemeContext & ThemeToggle", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const k in store) delete store[k];
      },
    });

    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    document.documentElement.className = "";
  });

  it("toggles between light and dark modes", () => {
    render(
      <ThemeProvider>
        <TestConsumer />
        <ThemeToggle variant="icon" />
      </ThemeProvider>
    );

    const button = screen.getByRole("button");
    const indicator = screen.getByTestId("resolved");

    expect(indicator.textContent).toBe("light");

    // Toggle to dark
    fireEvent.click(button);
    expect(indicator.textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    // Toggle back to light
    fireEvent.click(button);
    expect(indicator.textContent).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
