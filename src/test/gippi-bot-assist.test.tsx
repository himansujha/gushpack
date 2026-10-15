import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GippiBotAssist } from "@/components/ui/gippi-bot-assist";

describe("GippiBotAssist", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    // Mock HTMLCanvasElement getContext
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillStyle: "",
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  it("renders with placeholder and send button", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <GippiBotAssist placeholder="Ask Gippi anything about your leads…" />
      </QueryClientProvider>
    );

    const input = screen.getByPlaceholderText("Ask Gippi anything about your leads…");
    expect(input).toBeInTheDocument();

    const sendBtn = screen.getByLabelText("Send");
    expect(sendBtn).toBeInTheDocument();
  });

  it("updates value on input change", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <GippiBotAssist />
      </QueryClientProvider>
    );

    const input = screen.getByRole("textbox", { name: "Ask Gippi anything" }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Show hot leads" } });
    expect(input.value).toBe("Show hot leads");
  });

  it("renders sleeping questions animation on collapsed circular chatbot icon", () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <GippiBotAssist />
      </QueryClientProvider>
    );

    const questionsContainer = container.querySelector(".mo-sleep-questions");
    expect(questionsContainer).toBeInTheDocument();

    const questions = container.querySelectorAll(".mo-sleep-q");
    expect(questions.length).toBe(3);
    questions.forEach((q) => {
      expect(q.textContent).toBe("?");
    });
  });
});
