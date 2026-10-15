import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  Search,
  ChevronRight,
  User,
  Users,
  Clock,
  CalendarClock,
  Flame,
  SunMedium,
  Snowflake,
  Check,
  ChevronDown,
  Phone,
  Copy,
  Send,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ClassBadge, OverdueBadge } from "@/components/lead-bits";
import { daysBetween, dueState, formatDate, getFollowUpInstruction, leadsQuery, localToday } from "@/lib/lead-queries";
import { markSent } from "@/lib/leads.functions";
import { useToday } from "@/hooks/use-today";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

const FILTERS = ["All", "Overdue", "Due Today", "Hot", "Warm", "Cold"] as const;

export const Route = createFileRoute("/leads/")({
  validateSearch: (search: Record<string, unknown>): { filter?: (typeof FILTERS)[number] | undefined } => {
    const raw = search["filter"];
    return {
      filter:
        typeof raw === "string" && FILTERS.includes(raw as (typeof FILTERS)[number])
          ? (raw as (typeof FILTERS)[number])
          : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "All Leads — gushpack" },
      { name: "description", content: "Every lead with its Hot, Warm or Cold classification and next follow-up date." },
      { property: "og:title", content: "All Leads — gushpack" },
      { property: "og:description", content: "Every lead with its Hot, Warm or Cold classification and next follow-up date." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(leadsQuery),
  component: LeadsPage,
});

function LeadsPage() {
  const { data: leads } = useSuspenseQuery(leadsQuery);
  const search = Route.useSearch();
  const today = useToday();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const filter = (search.filter && FILTERS.includes(search.filter as (typeof FILTERS)[number])
    ? search.filter
    : "All") as (typeof FILTERS)[number];

  const [q, setQ] = useState("");
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const rank = { Hot: 0, Warm: 1, Cold: 2 } as Record<string, number>;

  const markSentMutation = useMutation({
    mutationFn: async ({ leadId, message }: { leadId: string; message: string }) => {
      setSendingId(leadId);
      return markSent({ data: { leadId, message, today: localToday() } });
    },
    onSuccess: async (r, variables) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["leads"] }),
        qc.invalidateQueries({ queryKey: ["lead", variables.leadId] }),
      ]);
      toast.success("Marked as sent", {
        description: r.next ? `Next follow-up: ${formatDate(r.next)}` : undefined,
      });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Could not mark as sent");
    },
    onSettled: () => {
      setSendingId(null);
    },
  });

  const handleCopy = async (e: React.MouseEvent, leadId: string, text: string) => {
    e.stopPropagation();
    e.preventDefault();
    await copyToClipboard(text);
    setCopiedId(leadId);
    toast.success("Suggested message copied");
    setTimeout(() => {
      setCopiedId((prev) => (prev === leadId ? null : prev));
    }, 2000);
  };

  const handleMarkSent = (e: React.MouseEvent, leadId: string, message: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (sendingId) return;
    const toastId = toast.loading("Sending follow-up…");
    setSendingId(leadId);
    markSent({ data: { leadId, message, today: localToday() } })
      .then(async (r) => {
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["leads"] }),
          qc.invalidateQueries({ queryKey: ["lead", leadId] }),
        ]);
        toast.success("Marked as sent", {
          id: toastId,
          description: r.next ? `Next follow-up: ${formatDate(r.next)}` : undefined,
        });
      })
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Could not mark as sent", {
          id: toastId,
        });
      })
      .finally(() => {
        setSendingId(null);
      });
  };

  const overdueCount = useMemo(
    () =>
      leads.filter(
        (l) => l.analysis && !l.analysis.do_not_contact && dueState(l.analysis.next_follow_up_date, today) === "overdue"
      ).length,
    [leads, today]
  );
  const dueTodayCount = useMemo(
    () =>
      leads.filter(
        (l) => l.analysis && !l.analysis.do_not_contact && dueState(l.analysis.next_follow_up_date, today) === "today"
      ).length,
    [leads, today]
  );
  const hotCount = useMemo(() => leads.filter((l) => l.analysis?.classification === "Hot").length, [leads]);
  const warmCount = useMemo(() => leads.filter((l) => l.analysis?.classification === "Warm").length, [leads]);
  const coldCount = useMemo(() => leads.filter((l) => l.analysis?.classification === "Cold").length, [leads]);

  const FILTER_OPTIONS = [
    { id: "All", label: "All leads", chipLabel: "All", icon: Users, count: leads.length, color: "text-foreground" },
    { id: "Overdue", label: "Overdue", chipLabel: "Overdue", icon: Clock, count: overdueCount, color: "text-overdue" },
    { id: "Due Today", label: "Due Today", chipLabel: "Due Today", icon: CalendarClock, count: dueTodayCount, color: "text-today" },
    { id: "Hot", label: "Hot", chipLabel: "Hot", icon: Flame, count: hotCount, color: "text-hot" },
    { id: "Warm", label: "Warm", chipLabel: "Warm", icon: SunMedium, count: warmCount, color: "text-warm" },
    { id: "Cold", label: "Cold", chipLabel: "Cold", icon: Snowflake, count: coldCount, color: "text-cold" },
  ] as const;

  const currentOption = FILTER_OPTIONS.find((opt) => opt.id === filter) ?? FILTER_OPTIONS[0];
  const CurrentIcon = currentOption.icon;

  const rows = leads
    .filter((l) => {
      if (filter === "All") return true;
      if (filter === "Overdue") {
        return l.analysis && !l.analysis.do_not_contact && dueState(l.analysis.next_follow_up_date, today) === "overdue";
      }
      if (filter === "Due Today") {
        return l.analysis && !l.analysis.do_not_contact && dueState(l.analysis.next_follow_up_date, today) === "today";
      }
      return l.analysis?.classification === filter;
    })
    .filter((l) => !q || `${l.name} ${l.company} ${l.phone} ${l.rep_name}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (rank[a.analysis?.classification ?? "Cold"] ?? 3) - (rank[b.analysis?.classification ?? "Cold"] ?? 3) || a.name.localeCompare(b.name));

  return (
    <div className="space-y-6 pb-12">
      {/* Title */}
      <div className="pt-2">
        <div className="flex items-center justify-between sm:justify-start sm:items-baseline sm:gap-3">
          <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-foreground">
            All leads
          </h1>
          <span className="hidden sm:inline-flex rounded-full bg-surface-container px-3 py-1 text-xs font-medium text-muted-foreground">
            {leads.length} contacts
          </span>

          {/* Mobile Filter Dropdown (shown only on mobile, placed on the right of the All leads heading) */}
          <div className="flex sm:hidden items-center">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "group flex items-center justify-between gap-2.5 rounded-full px-3.5 py-2 text-sm font-medium transition-all duration-150 cursor-pointer border-0 outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-xs",
                    filter !== "All"
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-surface-container hover:bg-surface-container-high text-foreground"
                  )}
                  aria-label="Filter leads"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "grid size-6 place-items-center rounded-full text-xs font-medium",
                        filter !== "All"
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-surface-container-highest text-muted-foreground"
                      )}
                    >
                      <CurrentIcon className={cn("size-3.5", filter === "All" && currentOption.color)} />
                    </div>
                    <span>{currentOption.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums leading-none",
                        filter !== "All"
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-surface-container-highest text-foreground"
                      )}
                    >
                      {currentOption.count}
                    </span>
                    <ChevronDown
                      className={cn(
                        "size-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180",
                        filter !== "All" ? "text-primary-foreground" : "text-muted-foreground"
                      )}
                    />
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 rounded-3xl bg-surface-container-high p-2 border border-surface-container-highest/80 shadow-xl text-foreground flex flex-col gap-1.5"
              >
                {FILTER_OPTIONS.map((opt) => {
                  const isSelected = filter === opt.id;
                  const Icon = opt.icon;
                  return (
                    <DropdownMenuItem
                      key={opt.id}
                      onClick={() => {
                        navigate({ to: "/leads", search: opt.id === "All" ? {} : { filter: opt.id } });
                      }}
                      className={cn(
                        "flex items-center justify-between rounded-3xl px-3 py-2 text-sm font-medium cursor-pointer transition-colors outline-none",
                        isSelected
                          ? "bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground font-semibold"
                          : "text-foreground hover:bg-surface-container-highest focus:bg-surface-container-highest focus:text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            "grid size-6 place-items-center rounded-full text-xs font-medium",
                            isSelected
                              ? "bg-primary-foreground/20 text-primary-foreground"
                              : "bg-surface-container-highest text-muted-foreground"
                          )}
                        >
                          <Icon className={cn("size-3.5", !isSelected && opt.color)} />
                        </div>
                        <span>{opt.label}</span>
                      </div>
                      {isSelected ? (
                        <Check className="size-4 shrink-0" />
                      ) : (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {opt.count}
                        </span>
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile contact count below heading */}
        <div className="mt-1.5 sm:hidden">
          <span className="rounded-full bg-surface-container px-3 py-1 text-xs font-medium text-muted-foreground inline-flex items-center">
            {leads.length} contacts
          </span>
        </div>
      </div>

      {/* Material 3 Controls Bar: Search + Filter Chips */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        {/* Desktop Filter Chips (hidden on mobile, shown on sm+) */}
        <div className="hidden sm:flex flex-wrap items-center gap-2">
          {FILTER_OPTIONS.map((opt) => {
            const active = filter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  navigate({ to: "/leads", search: opt.id === "All" ? {} : { filter: opt.id } });
                }}
                className={cn(
                  "group inline-flex items-center gap-2.5 rounded-full pl-4 pr-1.5 py-1.5 text-sm font-semibold transition-colors duration-150 cursor-pointer border-0",
                  active
                    ? "bg-primary text-primary-foreground shadow-none"
                    : "bg-surface-container text-foreground hover:bg-surface-container-high"
                )}
              >
                <span>{opt.chipLabel}</span>
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums leading-none",
                    active
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-surface-container-high text-foreground"
                  )}
                >
                  {opt.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Docked pill search bar */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search leads, company, rep…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-11 w-full rounded-full border-0 bg-surface-container-highest pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all focus:bg-surface-container focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Standalone Lead Cards List (no nested outer card) */}
      <div className="min-h-[460px]">
        {rows.length === 0 ? (
          <div className="rounded-3xl bg-surface-container-low py-16 text-center text-muted-foreground">
            <p className="text-base font-medium text-foreground">No matching leads</p>
            <p className="mt-1 text-sm">Try adjusting your search query or filter chip.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((l) => {
              const a = l.analysis;
              const isOverdue = !!(a?.next_follow_up_date && a.next_follow_up_date < today && !a?.do_not_contact);
              const isToday = !!(a?.next_follow_up_date && a.next_follow_up_date === today && !a?.do_not_contact);
              const isUpcoming = !!(a?.next_follow_up_date && a.next_follow_up_date > today && !a?.do_not_contact);

              return (
                <li key={l.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate({ to: "/leads/$id", params: { id: l.id } })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate({ to: "/leads/$id", params: { id: l.id } });
                      }
                    }}
                    className="group block rounded-3xl max-sm:rounded-bl-[64px] p-5 sm:p-6 transition-colors duration-150 border-0 bg-surface-container hover:bg-surface-container-high cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {/* Header line with date, pill badges, and Assigned to on top right */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                        {a?.next_follow_up_date && (
                          <span className="font-mono text-xs text-muted-foreground">
                            {formatDate(a.next_follow_up_date)}
                          </span>
                        )}

                        {isOverdue && (
                          <OverdueBadge days={daysBetween(a!.next_follow_up_date!, today)} />
                        )}
                        {isToday && (
                          <span className="rounded-full bg-today-soft px-3 py-0.5 text-xs font-semibold text-today">
                            Due today
                          </span>
                        )}
                        {isUpcoming && (
                          <span className="rounded-full bg-surface-container-high px-3 py-0.5 text-xs font-medium text-muted-foreground">
                            Upcoming
                          </span>
                        )}
                        {a?.do_not_contact && (
                          <span className="rounded-full bg-surface-container-high px-3 py-0.5 text-xs font-medium text-muted-foreground">
                            Do not contact
                          </span>
                        )}

                        <ClassBadge value={a?.classification} />
                      </div>

                      {/* Assigned to rep badge on the top right (desktop only) */}
                      <div className="hidden sm:flex shrink-0 text-xs text-muted-foreground bg-surface-container-high/70 rounded-full px-3 py-1 items-center gap-1.5 font-medium">
                        <User className="size-3 text-muted-foreground" />
                        <span>Assigned to <span className="text-foreground font-semibold">{l.rep_name}</span></span>
                      </div>
                    </div>

                    {/* Lead info */}
                    <div className="mt-3.5 flex items-center gap-2">
                      {l.phone && (
                        <div className="relative group/phone hidden sm:inline-flex items-center">
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              await copyToClipboard(l.phone);
                              setCopiedPhoneId(l.id);
                              toast.success(`Copied phone: ${l.phone}`);
                              setTimeout(() => {
                                setCopiedPhoneId((prev) => (prev === l.id ? null : prev));
                              }, 2000);
                            }}
                            aria-label={`Copy phone ${l.phone}`}
                            className={cn(
                              "inline-flex size-7 shrink-0 items-center justify-center rounded-full border-0 shadow-2xs cursor-pointer select-none transition-colors duration-150 active:scale-95 transform-gpu",
                              copiedPhoneId === l.id
                                ? "bg-today-soft text-today"
                                : "bg-surface-container-lowest text-muted-foreground hover:text-foreground hover:bg-surface-container-low"
                            )}
                          >
                            {copiedPhoneId === l.id ? (
                              <Check className="size-3.5 transition-transform duration-200" />
                            ) : (
                              <Phone className="size-3.5 transition-transform duration-200 group-hover/phone:scale-110" />
                            )}
                          </button>

                          {/* Hover tooltip showing phone number */}
                          <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 opacity-0 group-hover/phone:opacity-100 transition-all duration-150 transform scale-95 group-hover/phone:scale-100 whitespace-nowrap rounded-full bg-surface-container-lowest text-foreground border border-outline-variant/40 px-3 py-1 font-mono text-xs shadow-md select-none flex items-center gap-1.5">
                            <Phone className="size-3 text-muted-foreground" />
                            <span>{copiedPhoneId === l.id ? "Copied!" : l.phone}</span>
                          </div>
                        </div>
                      )}

                      <div className="min-w-0">
                        <p className="text-lg font-medium tracking-tight text-foreground truncate">
                          {l.name}
                          <span className="hidden sm:inline font-normal text-muted-foreground text-base ml-2">
                            · {l.company}
                          </span>
                        </p>
                        <p className="sm:hidden text-sm text-muted-foreground truncate mt-0.5">
                          {l.company}
                        </p>
                      </div>
                    </div>

                    {/* Combined Gippi AI summary & suggestion card & action buttons row */}
                    <div className="mt-3.5">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 sm:gap-3">
                        {(a?.reason || a?.draft_message || a?.suggested_message) ? (
                          <>
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="w-full min-w-0 flex-1 rounded-3xl bg-surface-container-lowest px-5 py-4 text-sm text-foreground/90 transition-colors shadow-2xs"
                            >
                              {/* Gippi AI Summary */}
                              {a?.reason && (
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
                              )}

                              {/* Divider between Summary and Suggestion */}
                              {a?.reason && (a?.draft_message || a?.suggested_message) && (
                                <div className="border-t border-outline-variant/30 my-3" />
                              )}

                              {/* Suggested WhatsApp message */}
                              {(a?.draft_message || a?.suggested_message) && (
                                <div>
                                  <div className="mb-2">
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
                                      {getFollowUpInstruction(a, l.id)}
                                    </p>
                                  </div>

                                  <p className="italic text-foreground/90 whitespace-pre-wrap leading-relaxed select-text">
                                    “{a.draft_message ?? a.suggested_message}”
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Action buttons: Rep badge on far left on mobile, then Call, Copy, Mark as Sent, Open Lead on right */}
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="flex flex-row items-center justify-between sm:justify-start gap-2.5 w-full sm:w-auto shrink-0"
                            >
                              {/* Mobile: Rep name and icon on the far left in the same row */}
                              <div className="sm:hidden shrink-0 text-xs text-muted-foreground bg-surface-container-high/70 rounded-full px-3 py-1.5 flex items-center gap-1.5 font-medium mr-auto">
                                <User className="size-3 text-muted-foreground" />
                                <span className="text-foreground font-semibold">{l.rep_name}</span>
                              </div>

                              <div className="flex items-center sm:flex-col sm:items-stretch gap-2.5 sm:gap-3 shrink-0">
                                {/* Call button on mobile devices (placed right before the copy button) */}
                                {l.phone && (
                                  <a
                                    href={`tel:${l.phone}`}
                                    onClick={(e) => e.stopPropagation()}
                                    aria-label={`Call ${l.name}`}
                                    className="inline-flex sm:hidden size-10 shrink-0 items-center justify-center rounded-full border-0 bg-surface-container-lowest text-foreground hover:bg-surface-container-low shadow-xs cursor-pointer select-none transition-colors duration-200 ease-out active:scale-95 transform-gpu"
                                  >
                                    <Phone className="size-4.5 transition-transform duration-300 ease-out transform-gpu" />
                                  </a>
                                )}

                                {/* Open lead details: wide pill on desktop placed on top, circle on mobile placed at end */}
                                <div className="relative group/open inline-flex items-center order-last sm:order-first sm:w-full">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate({ to: "/leads/$id", params: { id: l.id } });
                                    }}
                                    aria-label="Open lead details"
                                    className="inline-flex size-10 sm:size-auto sm:w-full sm:h-12 sm:px-4 shrink-0 items-center justify-center gap-2 rounded-full border-0 bg-primary text-primary-foreground shadow-xs cursor-pointer select-none transition-all duration-200 ease-out active:scale-95 transform-gpu"
                                  >
                                    <span className="hidden sm:inline font-semibold text-sm tracking-tight">Open</span>
                                    <ChevronRight className="size-4.5 sm:size-5 transition-transform duration-300 ease-out transform-gpu group-hover/open:translate-x-0.5" />
                                  </button>
                                  <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 opacity-0 group-hover/open:opacity-100 transition-all duration-150 transform scale-95 group-hover/open:scale-100 whitespace-nowrap rounded-full bg-surface-container-lowest text-foreground border border-outline-variant/40 px-3 py-1 text-xs shadow-md select-none">
                                    Open lead details
                                  </div>
                                </div>

                                {(a?.draft_message || a?.suggested_message) && (
                                  <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                                    <div className="relative group/copy inline-flex items-center">
                                      <button
                                        type="button"
                                        onClick={(e) => handleCopy(e, l.id, a.draft_message ?? a.suggested_message ?? "")}
                                        aria-label="Copy suggested message"
                                        className={cn(
                                          "inline-flex size-10 sm:size-12 shrink-0 items-center justify-center rounded-full border-0 shadow-xs cursor-pointer select-none transition-colors duration-200 ease-out active:scale-95 transform-gpu",
                                          copiedId === l.id
                                            ? "bg-today-soft text-today"
                                            : "bg-surface-container-lowest text-foreground hover:bg-surface-container-low"
                                        )}
                                      >
                                        {copiedId === l.id ? (
                                          <Check className="size-4.5 sm:size-5 transition-transform duration-300 ease-out transform-gpu" />
                                        ) : (
                                          <Copy className="size-4.5 sm:size-5 transition-transform duration-300 ease-out transform-gpu group-hover/copy:scale-110" />
                                        )}
                                      </button>
                                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 opacity-0 group-hover/copy:opacity-100 transition-all duration-150 transform scale-95 group-hover/copy:scale-100 whitespace-nowrap rounded-full bg-surface-container-lowest text-foreground border border-outline-variant/40 px-3 py-1 text-xs shadow-md select-none">
                                        {copiedId === l.id ? "Copied message" : "Copy message"}
                                      </div>
                                    </div>

                                    <div className="relative group/sent inline-flex items-center">
                                      <button
                                        type="button"
                                        onClick={(e) => handleMarkSent(e, l.id, a.draft_message ?? a.suggested_message ?? "")}
                                        disabled={sendingId === l.id || !!a?.do_not_contact}
                                        aria-label={a?.do_not_contact ? "Do not contact" : "Mark as sent"}
                                        className={cn(
                                          "inline-flex size-10 sm:size-12 shrink-0 items-center justify-center rounded-full border-0 shadow-xs cursor-pointer select-none transition-colors duration-200 ease-out active:scale-95 transform-gpu",
                                          sendingId === l.id
                                            ? "opacity-60 cursor-not-allowed bg-surface-container-lowest text-muted-foreground"
                                            : "bg-surface-container-lowest text-foreground hover:bg-surface-container-low"
                                        )}
                                      >
                                        {sendingId === l.id ? (
                                          <Loader2 className="size-4.5 sm:size-5 animate-spin" />
                                        ) : (
                                          <Send className="size-4.5 sm:size-5 transition-transform duration-300 ease-out transform-gpu group-hover/sent:scale-110" />
                                        )}
                                      </button>
                                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 opacity-0 group-hover/sent:opacity-100 transition-all duration-150 transform scale-95 group-hover/sent:scale-100 whitespace-nowrap rounded-full bg-surface-container-lowest text-foreground border border-outline-variant/40 px-3 py-1 text-xs shadow-md select-none">
                                        {a?.do_not_contact ? "Do not contact" : "Mark as sent"}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-row items-center justify-between sm:justify-end w-full">
                            {/* Mobile: Rep name and icon on the far left in the same row */}
                            <div className="sm:hidden shrink-0 text-xs text-muted-foreground bg-surface-container-high/70 rounded-full px-3 py-1.5 flex items-center gap-1.5 font-medium mr-auto">
                              <User className="size-3 text-muted-foreground" />
                              <span className="text-foreground font-semibold">{l.rep_name}</span>
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0">
                              {l.phone && (
                                <a
                                  href={`tel:${l.phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label={`Call ${l.name}`}
                                  className="inline-flex sm:hidden size-10 shrink-0 items-center justify-center rounded-full border-0 bg-surface-container-lowest text-foreground hover:bg-surface-container-low shadow-xs cursor-pointer select-none transition-colors duration-200 ease-out active:scale-95 transform-gpu"
                                >
                                  <Phone className="size-4.5 transition-transform duration-300 ease-out transform-gpu" />
                                </a>
                              )}
                              <div className="relative group/open inline-flex items-center">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate({ to: "/leads/$id", params: { id: l.id } });
                                  }}
                                  aria-label="Open lead details"
                                  className="inline-flex size-10 sm:size-auto sm:min-w-[108px] sm:h-12 sm:px-5 shrink-0 items-center justify-center gap-2 rounded-full border-0 bg-primary text-primary-foreground shadow-xs cursor-pointer select-none transition-all duration-200 ease-out active:scale-95 transform-gpu"
                                >
                                  <span className="hidden sm:inline font-semibold text-sm tracking-tight">Open</span>
                                  <ChevronRight className="size-4.5 sm:size-5 transition-transform duration-300 ease-out transform-gpu group-hover/open:translate-x-0.5" />
                                </button>
                                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 opacity-0 group-hover/open:opacity-100 transition-all duration-150 transform scale-95 group-hover/open:scale-100 whitespace-nowrap rounded-full bg-surface-container-lowest text-foreground border border-outline-variant/40 px-3 py-1 text-xs shadow-md select-none">
                                  Open lead details
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
