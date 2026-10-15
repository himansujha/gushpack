import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConversationBuilder } from "@/components/ConversationBuilder";

describe("ConversationBuilder", () => {
  it("renders Client and Assigned Rep options with provided names", () => {
    render(
      <ConversationBuilder
        clientName="Vikram Singh"
        repName="Neha Sharma"
        value=""
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Vikram Singh")).toBeInTheDocument();
    expect(screen.getByText("Neha Sharma")).toBeInTheDocument();
  });

  it("opens composer when clicking + on Client and adds message", () => {
    const handleChange = vi.fn();
    render(
      <ConversationBuilder
        clientName="Vikram Singh"
        repName="Neha Sharma"
        value=""
        onChange={handleChange}
      />,
    );

    const clientPlusBtn = screen.getByLabelText("Add message from Client Vikram Singh");
    fireEvent.click(clientPlusBtn);

    const textarea = screen.getByPlaceholderText(/Paste single conversation text from Vikram Singh here/);
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveClass("rounded-3xl");
    expect(textarea).toHaveClass("border-0");

    fireEvent.change(textarea, { target: { value: "Hello, need price details." } });

    const addBtn = screen.getByRole("button", { name: /Add to chat/i });
    fireEvent.click(addBtn);

    expect(screen.getByText("Hello, need price details.")).toBeInTheDocument();
    expect(handleChange).toHaveBeenCalledWith("Vikram Singh: Hello, need price details.");
  });

  it("adds rep message when clicking + on Assigned Rep", () => {
    const handleChange = vi.fn();
    render(
      <ConversationBuilder
        clientName="Vikram Singh"
        repName="Neha Sharma"
        value=""
        onChange={handleChange}
      />,
    );

    const repPlusBtn = screen.getByLabelText("Add message from Assigned Rep Neha Sharma");
    fireEvent.click(repPlusBtn);

    const textarea = screen.getByPlaceholderText(/Paste single conversation text from Neha Sharma here/);
    fireEvent.change(textarea, { target: { value: "Sure, sending the catalog." } });

    const addBtn = screen.getByRole("button", { name: /Add to chat/i });
    fireEvent.click(addBtn);

    expect(screen.getByText("Sure, sending the catalog.")).toBeInTheDocument();
    expect(handleChange).toHaveBeenCalledWith("Neha Sharma: Sure, sending the catalog.");
  });

  it("allows removing a message", () => {
    const handleChange = vi.fn();
    render(
      <ConversationBuilder
        clientName="Vikram Singh"
        repName="Neha Sharma"
        value="Vikram Singh: Message 1"
        onChange={handleChange}
      />,
    );

    expect(screen.getByText("Message 1")).toBeInTheDocument();

    const removeBtn = screen.getByLabelText("Remove message");
    fireEvent.click(removeBtn);

    expect(screen.queryByText("Message 1")).not.toBeInTheDocument();
    expect(handleChange).toHaveBeenCalledWith("");
  });
});
