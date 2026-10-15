import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, Loader2, MessageSquarePlus, Phone, RefreshCw, Send, Building2, Calendar, User, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { ConversationBuilder } from "@/components/ConversationBuilder";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClassBadge, OverdueBadge } from "@/components/lead-bits";
import { addConversation, markSent, reanalyze, saveDraft } from "@/lib/leads.functions";
import { daysBetween, dueState, formatDate, getFollowUpInstruction, leadQuery, localToday } from "@/lib/lead-queries";
import { useToday } from "@/hooks/use-today";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/leads/$id")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(leadQuery(params.id));
    if (!data) throw notFound();
    return { name: data.lead.name, company: data.lead.company };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.name} (${loaderData.company}) — gushpack` : "Lead — gushpack";
    const description = "Conversation history, AI classification and the next follow-up message for this lead.";
    return { meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }] };
  },
  component: LeadPage,
  errorComponent: ({ error }) => <p className="text-destructive p-8 text-center font-medium">Could not load this lead: {(error as Error).message}</p>,
  notFoundComponent: () => (
    <div className="py-20 text-center">
      <p className="text-xl font-medium text-foreground">Lead not found</p>
      <p className="mt-2 text-sm text-muted-foreground">The lead you are looking for does not exist or was deleted.</p>
      <Link to="/leads" className="mt-4 inline-flex items-center justify-center rounded-full bg-secondary-container px-5 py-2 text-sm font-medium text-on-secondary-container">
        Back to all leads
      </Link>
    </div>
  ),
});

function LeadPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(leadQuery(id));
  const today = useToday();
  const qc = useQueryClient();
  const [draft, setDraft] = useState(data?.analysis?.draft_message ?? "");
  const [convoOpen, setConvoOpen] = useState(false);

  const savedDraft = data?.analysis?.draft_message ?? "";
  useEffect(() => setDraft(savedDraft), [savedDraft]);

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["lead", id] }), qc.invalidateQueries({ queryKey: ["leads"] })]);

  const save = useMutation({
    mutationFn: () => saveDraft({ data: { leadId: id, draft } }),
    onSuccess: async () => { await refresh(); toast.success("Draft saved"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save draft"),
  });
  const sent = useMutation({
    mutationFn: () => markSent({ data: { leadId: id, message: draft, today: localToday() } }),
    onSuccess: async (r) => { await refresh(); toast.success("Marked as sent", { description: r.next ? `Next follow-up: ${formatDate(r.next)}` : undefined }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not mark as sent"),
  });
  const retry = useMutation({
    mutationFn: () => reanalyze({ data: { leadId: id, today: localToday() } }),
    onSuccess: async (r) => { await refresh(); r.ok ? toast.success("Analysis updated") : toast.error(r.error); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Analysis failed"),
  });

  if (!data) return null;
  const { lead, messages, analysis: a, activities } = data;
  const state = dueState(a?.next_follow_up_date, today);
  const dirty = draft.trim() !== savedDraft.trim();
  const newSuggestion = a?.draft_edited && a.suggested_message && a.suggested_message !== a.draft_message;
  const navigate = useNavigate();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1 && document.referrer && document.referrer.includes(window.location.host)) {
      window.history.back();
      return;
    }

    if (typeof window !== "undefined") {
      const savedMenu = sessionStorage.getItem("gushpack_active_menu");
      if (savedMenu === "all-leads") {
        navigate({ to: "/leads" });
        return;
      }
      if (savedMenu === "overdue") {
        navigate({ to: "/leads", search: { filter: "Overdue" } });
        return;
      }
      if (savedMenu === "due-today") {
        navigate({ to: "/leads", search: { filter: "Due Today" } });
        return;
      }
      if (savedMenu === "hot") {
        navigate({ to: "/leads", search: { filter: "Hot" } });
        return;
      }
      if (savedMenu === "warm") {
        navigate({ to: "/leads", search: { filter: "Warm" } });
        return;
      }
      if (savedMenu === "cold") {
        navigate({ to: "/leads", search: { filter: "Cold" } });
        return;
      }
    }
    navigate({ to: "/" });
  };

  return (
    <div className="space-y-6 pb-16">

      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back to leads"
            className="grid size-12 sm:size-14 place-items-center rounded-full bg-surface-container hover:bg-surface-container-high text-foreground hover:text-primary transition-all duration-150 cursor-pointer active:scale-95 shrink-0 select-none border-0 shadow-2xs"
          >
            <ArrowLeft className="size-5 sm:size-6 stroke-[2]" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-3xl font-medium tracking-tight text-foreground">{lead.name}</h1>
              {a?.classification && <ClassBadge value={a.classification} />}
              {!a?.do_not_contact && state === "overdue" && a?.next_follow_up_date && (
                <OverdueBadge days={daysBetween(a.next_follow_up_date, today)} />
              )}
              {!a?.do_not_contact && state === "today" && (
                <span className="rounded-full bg-today-soft px-3 py-1 text-xs font-semibold text-today">
                  Due today
                </span>
              )}
              {a?.follow_up_status === "sent" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-3 py-1 text-xs font-medium text-success">
                  <Check className="size-3.5" /> Follow-up recorded
                </span>
              )}
            </div>
            <p className="text-base text-muted-foreground">{lead.company}</p>
          </div>
        </div>

        <div>
          <Button variant="secondary" className="rounded-full gap-2" onClick={() => setConvoOpen(true)}>
            <MessageSquarePlus className="size-4" />
            <span>Add conversation</span>
          </Button>
        </div>
      </div>

      {/* 2-Column Responsive Layout */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        {/* Left Column: Contact, AI Analysis, Follow-up Message */}
        <div className="space-y-6">
          {/* Contact Details Surface */}
          <section className="rounded-3xl bg-surface-container p-6 border-0">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
              Contact Overview
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="rounded-2xl bg-surface-container-high/60 p-3.5 flex items-center gap-3">
                <Phone className="size-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="font-mono text-sm font-medium text-foreground truncate">{lead.phone}</p>
                </div>
              </div>

              <div className="rounded-2xl bg-surface-container-high/60 p-3.5 flex items-center gap-3">
                <User className="size-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Sales Rep</p>
                  <p className="text-sm font-medium text-foreground truncate">{lead.rep_name}</p>
                </div>
              </div>

              <div className="rounded-2xl bg-surface-container-high/60 p-3.5 flex items-center gap-3">
                <Tag className="size-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Source</p>
                  <p className="text-sm font-medium text-foreground truncate">{lead.source}</p>
                </div>
              </div>

              <div className="rounded-2xl bg-surface-container-high/60 p-3.5 flex items-center gap-3">
                <Calendar className="size-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Last Contact</p>
                  <p className="font-mono text-sm font-medium text-foreground truncate">{formatDate(lead.last_contact_date)}</p>
                </div>
              </div>
            </div>
          </section>

          {/* AI Analysis Surface (Gemini/Assistant Style) */}
          <section className="rounded-3xl bg-surface-container p-6 border-0">
            <div className="min-w-0">
              {a?.reason ? (
                <p className="text-sm text-foreground/90 leading-relaxed">
                  <span className="font-semibold text-foreground inline-flex items-center gap-1.5 mr-1.5 select-none align-middle -translate-y-px">
                    <img
                      src="/bot-icon-light.svg"
                      alt=""
                      aria-hidden="true"
                      className="size-5 shrink-0 inline-block dark:hidden"
                    />
                    <img
                      src="/bot-icon-dark.svg"
                      alt=""
                      aria-hidden="true"
                      className="size-5 shrink-0 hidden dark:inline-block"
                    />
                    gippi:
                  </span>
                  {a.reason}
                </p>
              ) : (
                <div className="flex items-center gap-1.5 select-none">
                  <img
                    src="/bot-icon-light.svg"
                    alt=""
                    aria-hidden="true"
                    className="size-5 shrink-0 inline-block dark:hidden"
                  />
                  <img
                    src="/bot-icon-dark.svg"
                    alt=""
                    aria-hidden="true"
                    className="size-5 shrink-0 hidden dark:inline-block"
                  />
                  <span className="text-sm font-semibold tracking-tight text-foreground lowercase">
                    gippi:
                  </span>
                </div>
              )}
            </div>

            {a?.status === "failed" && (
              <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-destructive-container p-4 text-sm text-on-destructive-container">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>The latest analysis failed: {a.error}. Showing previous assessment below.</p>
              </div>
            )}

            {!a?.classification && (
              <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                <p className="text-muted-foreground">
                  {a?.status === "pending"
                    ? "Analysing conversation history…"
                    : a?.status === "failed"
                      ? "Analysis could not complete."
                      : "No analysis available yet."}
                </p>
                {a?.status === "failed" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-xs font-medium gap-1.5"
                    onClick={() => retry.mutate()}
                    disabled={retry.isPending}
                  >
                    {retry.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                    <span>Retry analysis</span>
                  </Button>
                )}
              </div>
            )}
          </section>

          {/* Follow-up Draft Editor Surface */}
          <section className="rounded-3xl bg-surface-container p-6 border-0">
            <p className="text-sm text-foreground/90 leading-relaxed mb-3">
              <span className="font-semibold text-foreground inline-flex items-center gap-1.5 mr-1.5 select-none align-middle -translate-y-px">
                <img
                  src="/bot-icon-light.svg"
                  alt=""
                  aria-hidden="true"
                  className="size-5 shrink-0 inline-block dark:hidden"
                />
                <img
                  src="/bot-icon-dark.svg"
                  alt=""
                  aria-hidden="true"
                  className="size-5 shrink-0 hidden dark:inline-block"
                />
                gippi:
              </span>
              {getFollowUpInstruction(a, lead.id)}
            </p>

            {newSuggestion && (
              <div className="mb-4 rounded-2xl bg-secondary-container p-4 text-sm text-on-secondary-container">
                <p className="text-xs font-medium uppercase tracking-wider opacity-75 mb-1">New AI Suggestion Available</p>
                <p className="italic">“{a!.suggested_message}”</p>
                <Button size="sm" variant="default" className="mt-3 rounded-full text-xs" onClick={() => setDraft(a!.suggested_message!)}>
                  Apply this suggestion
                </Button>
              </div>
            )}

            <Textarea
              className="rounded-3xl"
              rows={5}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Draft message"
              disabled={!a?.classification}
              placeholder="Write or edit the message to send to the buyer…"
            />

            <div className="mt-2 flex justify-between text-xs text-muted-foreground px-1">
              <span>{a?.draft_edited ? "Edited by rep" : "Draft message by gippi"}{dirty && " · unsaved edits"}</span>
              <span>{draft.length}/2000</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2.5">
              <Button
                variant="secondary"
                className="rounded-full"
                onClick={() => save.mutate()}
                disabled={!dirty || !draft.trim() || save.isPending}
              >
                {save.isPending && <Loader2 className="size-4 animate-spin" />} Save draft
              </Button>

              <Button
                className="rounded-full gap-2"
                onClick={() => sent.mutate()}
                disabled={!draft.trim() || sent.isPending || !a?.classification || a.do_not_contact}
              >
                {sent.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Mark as Sent
              </Button>
            </div>
          </section>
        </div>

        {/* Right Column: WhatsApp History & Activity */}
        <div className="space-y-6">
          {/* Conversation History Surface */}
          <section className="rounded-3xl bg-surface-container p-6 border-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                WhatsApp History ({messages.length})
              </h2>
            </div>

            {messages.length === 0 ? (
              <div className="rounded-2xl bg-surface-container-high/60 p-8 text-center text-sm text-muted-foreground">
                <p>No messages recorded yet.</p>
                <p className="mt-1 text-xs">Use “Add conversation” to paste chat transcripts.</p>
              </div>
            ) : (
              <div className="space-y-3 rounded-2xl bg-[#efeae2] dark:bg-[#0b141a] p-4 max-h-[500px] overflow-y-auto">
                {messages.map((m) => (
                  <div key={m.id} className={cn("flex", m.sender === "rep" ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[85%] rounded-3xl px-4 py-3 text-sm shadow-none",
                      m.sender === "rep"
                        ? "bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef] rounded-br-sm"
                        : "bg-white text-[#111b21] dark:bg-[#202c33] dark:text-[#e9edef] rounded-bl-sm",
                    )}>
                      <p className={cn(
                        "text-[11px] font-semibold mb-0.5",
                        m.sender === "rep"
                          ? "text-[#008069] dark:text-[#25d366]"
                          : "text-[#128c7e] dark:text-[#53bdeb]",
                      )}>
                        {m.sender === "rep" ? lead.rep_name : lead.name}
                      </p>
                      <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                      <p className="mt-1 text-right font-mono text-[10px] text-[#667781] dark:text-[#8696a0]">
                        {new Date(m.sent_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Activity Timeline Surface */}
          <section className="rounded-3xl bg-surface-container p-6 border-0">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
              Activity History
            </h2>

            {!activities || activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <div className="space-y-3 text-sm">
                {activities.map((ac) => (
                  <div key={ac.id} className="flex items-start gap-3 rounded-2xl bg-surface-container-high/50 p-3">
                    <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground pt-0.5">
                      {new Date(ac.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <div className="flex-1 text-xs sm:text-sm text-foreground">
                      {ac.type === "sent" ? (
                        <>
                          <span className="font-medium text-success">Follow-up sent:</span>{" "}
                          <span className="text-muted-foreground italic">“{ac.details}”</span>
                        </>
                      ) : (
                        <span>{ac.details}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Add Conversation Dialog */}
      <AddConversationDialog
        open={convoOpen}
        onOpenChange={setConvoOpen}
        leadId={id}
        repName={lead.rep_name}
        buyerName={lead.name}
        onDone={refresh}
      />
    </div>
  );
}

function AddConversationDialog({
  open,
  onOpenChange,
  leadId,
  repName,
  buyerName,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  leadId: string;
  repName: string;
  buyerName: string;
  onDone: () => Promise<unknown>;
}) {
  const [text, setText] = useState("");
  const [date, setDate] = useState(localToday());
  const [error, setError] = useState("");
  const m = useMutation({
    mutationFn: () => addConversation({ data: { leadId, text, contactDate: date, today: localToday() } }),
    onSuccess: async (r) => {
      await onDone();
      if (r.analysis.ok) toast.success(`Added ${r.messages} messages and updated the analysis`);
      else toast.error(`Added ${r.messages} messages, but analysis failed: ${r.analysis.error}`, { description: "Use “Retry analysis” to try again." });
      setText("");
      onOpenChange(false);
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save the conversation"),
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!text.trim()) return setError("Please add at least one conversation message.");
    if (date > localToday()) return setError("Contact date can't be in the future.");
    m.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!m.isPending) { onOpenChange(o); setError(""); } }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border-0 bg-surface-container-high p-6 sm:p-8">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary mb-1">
            <MessageSquarePlus className="size-5" />
            <span className="text-xs font-medium uppercase tracking-wider">Conversation Log</span>
          </div>
          <DialogTitle>Add conversation</DialogTitle>
          <DialogDescription>
            New messages are appended to {buyerName}'s history and the assistant re-analyses follow-up timing.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-5" noValidate>
          <div className="grid gap-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              WhatsApp Messages
            </Label>
            <ConversationBuilder
              clientName={buyerName}
              repName={repName}
              value={text}
              onChange={setText}
            />
          </div>

          <div className="grid gap-1.5 sm:max-w-xs">
            <Label htmlFor="cdate" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Contact date
            </Label>
            <DatePicker id="cdate" max={localToday()} value={date} onChange={setDate} />
            <p className="text-xs text-muted-foreground">Used for messages without an explicit date.</p>
          </div>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)} disabled={m.isPending}>
              Cancel
            </Button>
            <Button type="submit" className="rounded-full" disabled={m.isPending}>
              {m.isPending ? <><Loader2 className="size-4 animate-spin" /> Analysing…</> : "Save conversation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
