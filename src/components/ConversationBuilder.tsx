"use client";

import * as React from "react";
import { Plus, X, User, Briefcase, Trash2, MessageSquare, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface ConversationMessage {
  id: string;
  sender: "client" | "rep";
  text: string;
}

export interface ConversationBuilderProps {
  clientName?: string;
  repName?: string;
  value?: string;
  onChange?: (val: string) => void;
  className?: string;
}

/**
 * Serializes messages array into plain chat transcript format recognized by parseWhatsApp
 */
function serializeMessages(
  msgs: ConversationMessage[],
  clientName: string,
  repName: string,
): string {
  const cName = clientName.trim() || "Client";
  const rName = repName.trim() || "Sales Rep";
  return msgs
    .map((m) => {
      const name = m.sender === "client" ? cName : rName;
      return `${name}: ${m.text.trim()}`;
    })
    .join("\n\n");
}

/**
 * Parses existing raw text into messages if switching modes or initialized
 */
function parseRawToMessages(
  rawText: string,
  repName: string,
): ConversationMessage[] {
  if (!rawText.trim()) return [];
  const lines = rawText.replace(/\r/g, "").split("\n");
  const result: ConversationMessage[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const match = line.match(/^([^:\n]{1,40}):\s*(.+)$/);
    if (match && match[1] && match[2] && !/^https?$/i.test(match[1])) {
      const senderLabel = match[1].trim().toLowerCase();
      const isRep =
        ["me", "you", "rep", "sales", "sales rep"].includes(senderLabel) ||
        (repName &&
          (senderLabel === repName.toLowerCase() ||
            senderLabel === repName.toLowerCase().split(" ")[0]));

      result.push({
        id: Math.random().toString(36).slice(2, 9),
        sender: isRep ? "rep" : "client",
        text: match[2].trim(),
      });
      continue;
    }

    const lastItem = result[result.length - 1];
    if (lastItem) {
      lastItem.text += "\n" + line;
    } else {
      result.push({
        id: Math.random().toString(36).slice(2, 9),
        sender: "client",
        text: line,
      });
    }
  }

  return result;
}

export function ConversationBuilder({
  clientName = "",
  repName = "",
  value = "",
  onChange,
  className,
}: ConversationBuilderProps) {
  // Local list of parsed messages
  const [messages, setMessages] = React.useState<ConversationMessage[]>(() =>
    parseRawToMessages(value, repName),
  );

  // Active composer: "client" | "rep" | null
  const [activeSender, setActiveSender] = React.useState<"client" | "rep" | null>(null);
  const [draftText, setDraftText] = React.useState("");
  const [showRawMode, setShowRawMode] = React.useState(false);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Focus textarea when composer opens
  React.useEffect(() => {
    if (activeSender && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [activeSender]);

  const displayClientName = clientName.trim() || "Client";
  const displayRepName = repName.trim() || "Assigned Rep";

  const handleOpenComposer = (sender: "client" | "rep") => {
    setActiveSender(sender);
  };

  const handleAddMessage = () => {
    if (!draftText.trim() || !activeSender) return;

    const newMessage: ConversationMessage = {
      id: Math.random().toString(36).slice(2, 9),
      sender: activeSender,
      text: draftText.trim(),
    };

    const nextMessages = [...messages, newMessage];
    setMessages(nextMessages);
    setDraftText("");
    setActiveSender(null);

    const serialized = serializeMessages(nextMessages, clientName, repName);
    onChange?.(serialized);
  };

  const handleRemoveMessage = (index: number) => {
    const nextMessages = messages.filter((_, i) => i !== index);
    setMessages(nextMessages);
    const serialized = serializeMessages(nextMessages, clientName, repName);
    onChange?.(serialized);
  };

  const handleClearAll = () => {
    setMessages([]);
    setActiveSender(null);
    setDraftText("");
    onChange?.("");
  };

  const handleRawChange = (newRaw: string) => {
    onChange?.(newRaw);
    setMessages(parseRawToMessages(newRaw, repName));
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Two Sender Selection Options with '+' buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* Client Option */}
        <div
          className={cn(
            "flex items-center justify-between rounded-2xl p-3 border-0 transition-all duration-150",
            activeSender === "client"
              ? "bg-surface-container-highest shadow-xs"
              : "bg-surface-container-highest/60 hover:bg-surface-container-highest",
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="size-8 rounded-full bg-surface-container grid place-items-center shrink-0 text-foreground">
              <User className="size-4 opacity-75" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Client
              </div>
              <div className="text-sm font-medium text-foreground truncate" title={displayClientName}>
                {displayClientName}
              </div>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            variant={activeSender === "client" ? "default" : "outline"}
            onClick={() => handleOpenComposer("client")}
            className="rounded-full size-8 p-0 shrink-0 cursor-pointer border-0 shadow-none"
            aria-label={`Add message from Client ${displayClientName}`}
          >
            <Plus className="size-4" />
          </Button>
        </div>

        {/* Assigned Rep Option */}
        <div
          className={cn(
            "flex items-center justify-between rounded-2xl p-3 border-0 transition-all duration-150",
            activeSender === "rep"
              ? "bg-surface-container-highest shadow-xs"
              : "bg-surface-container-highest/60 hover:bg-surface-container-highest",
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="size-8 rounded-full bg-surface-container grid place-items-center shrink-0 text-foreground">
              <Briefcase className="size-4 opacity-75" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Assigned Rep
              </div>
              <div className="text-sm font-medium text-foreground truncate" title={displayRepName}>
                {displayRepName}
              </div>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            variant={activeSender === "rep" ? "default" : "outline"}
            onClick={() => handleOpenComposer("rep")}
            className="rounded-full size-8 p-0 shrink-0 cursor-pointer border-0 shadow-none"
            aria-label={`Add message from Assigned Rep ${displayRepName}`}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      {/* Simple Box where single conversation is pasted/typed */}
      {activeSender && (
        <div className="rounded-3xl border-0 bg-surface-container-high p-4 sm:p-5 space-y-3 animate-in fade-in-0 duration-150">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-primary" />
              <span className="text-xs font-medium text-muted-foreground">
                Add message from:{" "}
                <span className="font-semibold text-foreground">
                  {activeSender === "client" ? displayClientName : displayRepName}
                </span>
                <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-container text-muted-foreground">
                  {activeSender === "client" ? "Client" : "Rep"}
                </span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveSender(null);
                setDraftText("");
              }}
              className="size-6 rounded-full hover:bg-surface-container grid place-items-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              aria-label="Close"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <Textarea
            ref={textareaRef}
            rows={3}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleAddMessage();
              }
            }}
            placeholder={`Paste single conversation text from ${
              activeSender === "client" ? displayClientName : displayRepName
            } here…`}
            className="font-sans text-xs sm:text-sm rounded-3xl border-0 bg-surface-container-highest px-4 py-3 resize-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          />

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-muted-foreground hidden sm:inline-block">
              No dates or times required
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setActiveSender(null);
                  setDraftText("");
                }}
                className="rounded-full text-xs h-8 px-3 border-0"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAddMessage}
                disabled={!draftText.trim()}
                className="rounded-full text-xs h-8 px-4 font-medium gap-1.5 cursor-pointer border-0"
              >
                <Plus className="size-3.5" />
                Add to chat
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Added Messages List */}
      {!showRawMode ? (
        messages.length > 0 ? (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span className="font-semibold text-foreground text-xs">
                Added Conversation ({messages.length})
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowRawMode(true)}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  Raw text view
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[11px] text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                >
                  Clear all
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {messages.map((msg, index) => {
                const isClient = msg.sender === "client";
                return (
                  <div
                    key={msg.id || index}
                    className={cn(
                      "group relative flex flex-col gap-1 rounded-2xl p-3 transition-all border-0",
                      isClient
                        ? "bg-surface-container-highest/90 mr-3 sm:mr-8"
                        : "bg-surface-container ml-3 sm:ml-8",
                    )}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold flex items-center gap-1.5 text-foreground">
                        {isClient ? (
                          <>
                            <User className="size-3 text-muted-foreground" />
                            <span>{displayClientName}</span>
                            <span className="text-[10px] font-normal uppercase text-muted-foreground bg-surface-container px-1.5 py-0.2 rounded-full">
                              Client
                            </span>
                          </>
                        ) : (
                          <>
                            <Briefcase className="size-3 text-muted-foreground" />
                            <span>{displayRepName}</span>
                            <span className="text-[10px] font-normal uppercase text-muted-foreground bg-surface-container-high px-1.5 py-0.2 rounded-full">
                              Rep
                            </span>
                          </>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveMessage(index)}
                        className="size-5 rounded-full hover:bg-surface-container-highest grid place-items-center text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                        aria-label="Remove message"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                    <p className="whitespace-pre-wrap text-foreground/90 font-sans text-xs sm:text-sm leading-relaxed pt-0.5">
                      {msg.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          !activeSender && (
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1 pt-1">
              <span>Click + next to Client or Assigned Rep to paste a message.</span>
              <button
                type="button"
                onClick={() => setShowRawMode(true)}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Paste full transcript
              </button>
            </div>
          )
        )
      ) : (
        /* Raw Text Area Fallback */
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span className="font-semibold text-foreground">Raw Chat Transcript</span>
            <button
              type="button"
              onClick={() => setShowRawMode(false)}
              className="text-[11px] text-primary hover:underline transition-colors cursor-pointer"
            >
              Switch back to easy builder
            </button>
          </div>
          <Textarea
            rows={5}
            className="font-mono text-xs"
            value={value}
            onChange={(e) => handleRawChange(e.target.value)}
            placeholder={`${displayClientName}: Hi, quote please\n${displayRepName}: Sure, sharing specs now.`}
          />
        </div>
      )}
    </div>
  );
}
