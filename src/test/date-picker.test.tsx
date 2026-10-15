import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DatePicker } from "@/components/ui/date-picker";

describe("DatePicker", () => {
  it("displays the date in dd/mm/yyyy format when value is provided", () => {
    render(<DatePicker value="2026-10-15" onChange={vi.fn()} />);
    expect(screen.getByText("15/10/2026")).toBeInTheDocument();
  });

  it("displays dd/mm/yyyy placeholder when no value is provided", () => {
    render(<DatePicker value="" onChange={vi.fn()} />);
    expect(screen.getByText("dd/mm/yyyy")).toBeInTheDocument();
  });

  it("correctly formats single-digit day and month to two digits", () => {
    render(<DatePicker value="2026-03-05" onChange={vi.fn()} />);
    expect(screen.getByText("05/03/2026")).toBeInTheDocument();
  });

  it("does not render redundant Select Date header", () => {
    render(<DatePicker value="2026-10-15" onChange={vi.fn()} />);
    expect(screen.queryByText("Select Date")).not.toBeInTheDocument();
  });
});
