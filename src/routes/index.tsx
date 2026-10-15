import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useToday } from "@/hooks/use-today";
import {
  AlertTriangle,
  ArrowUpDown,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Flame,
  Loader2,
  Phone,
  Send,
  Snowflake,
  Sparkles,
  SunMedium,
  User,
  Users,
} from "lucide-react";
import { ClassBadge, OverdueBadge } from "@/components/lead-bits";
import { daysBetween, dueState, formatDate, getFollowUpInstruction, leadsQuery, localToday, todaysFollowUps } from "@/lib/lead-queries";
import { markSent } from "@/lib/leads.functions";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Today's Follow-Ups — gushpack" },
      { name: "description", content: "See which buyers need a reply today, which follow-ups are overdue, and what to send next." },
      { property: "og:title", content: "Today's Follow-Ups — gushpack" },
      { property: "og:description", content: "See which buyers need a reply today, which follow-ups are overdue, and what to send next." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(leadsQuery),
  component: Dashboard,
});

function Dashboard() {
  const { data: leads } = useSuspenseQuery(leadsQuery);
  const today = useToday();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [rep, setRep] = useState("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

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
  const reps = useMemo(() => Array.from(new Set(leads.map((l) => l.rep_name))).sort(), [leads]);
  const scoped = rep === "all" ? leads : leads.filter((l) => l.rep_name === rep);
  const items = todaysFollowUps(scoped, today);
  const overdue = items.filter((l) => l.analysis!.next_follow_up_date! < today).length;
  const counts = { Hot: 0, Warm: 0, Cold: 0 };
  scoped.forEach((l) => { const c = l.analysis?.classification; if (c) counts[c]++; });

  type CardFilter = "overdue" | "today" | "Hot" | "Warm" | "Cold" | null;
  const [cardFilter, setCardFilter] = useState<CardFilter>(null);

  const FILTER_OPTIONS: {
    id: CardFilter | "all";
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count: number;
  }[] = [
    { id: "all", label: "Urgency", icon: Sparkles, count: items.length },
    { id: "overdue", label: "Overdue", icon: Clock, count: overdue },
    { id: "today", label: "Due Today", icon: CalendarClock, count: items.filter((l) => l.analysis?.next_follow_up_date === today).length },
    { id: "Hot", label: "Hot", icon: Flame, count: counts.Hot },
    { id: "Warm", label: "Warm", icon: SunMedium, count: counts.Warm },
    { id: "Cold", label: "Cold", icon: Snowflake, count: counts.Cold },
  ];

  const handleCardClick = (target: CardFilter) => {
    setCardFilter((prev) => (prev === target ? null : target));
  };

  const displayedLeads = useMemo(() => {
    if (cardFilter === "overdue") {
      return scoped
        .filter((l) => l.analysis?.next_follow_up_date && l.analysis.next_follow_up_date < today && !l.analysis.do_not_contact)
        .sort((a, b) => (a.analysis?.next_follow_up_date ?? "").localeCompare(b.analysis?.next_follow_up_date ?? ""));
    }
    if (cardFilter === "today") {
      return scoped.filter(
        (l) => l.analysis?.next_follow_up_date === today && !l.analysis.do_not_contact
      );
    }
    if (cardFilter === "Hot") {
      return scoped
        .filter((l) => l.analysis?.classification === "Hot")
        .sort((x, y) => {
          const a = x.analysis!, b = y.analysis!;
          if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
          return (a.next_follow_up_date ?? "").localeCompare(b.next_follow_up_date ?? "");
        });
    }
    if (cardFilter === "Warm") {
      return scoped
        .filter((l) => l.analysis?.classification === "Warm")
        .sort((x, y) => {
          const a = x.analysis!, b = y.analysis!;
          if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
          return (a.next_follow_up_date ?? "").localeCompare(b.next_follow_up_date ?? "");
        });
    }
    if (cardFilter === "Cold") {
      return scoped
        .filter((l) => l.analysis?.classification === "Cold")
        .sort((x, y) => {
          const a = x.analysis!, b = y.analysis!;
          if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
          return (a.next_follow_up_date ?? "").localeCompare(b.next_follow_up_date ?? "");
        });
    }
    return items;
  }, [cardFilter, scoped, items, today]);

  const sectionTitle =
    cardFilter === "overdue"
      ? `Overdue follow-ups (${displayedLeads.length})`
      : cardFilter === "today"
        ? `Due today follow-ups (${displayedLeads.length})`
        : cardFilter === "Hot"
          ? `Hot leads (${displayedLeads.length})`
          : cardFilter === "Warm"
            ? `Warm leads (${displayedLeads.length})`
            : cardFilter === "Cold"
              ? `Cold leads (${displayedLeads.length})`
              : `Queue (${items.length})`;

  const filterStatusText = useMemo(() => {
    if (!cardFilter) return "Sorted by urgency";
    if (cardFilter === "overdue") return "Filter by Overdue";
    if (cardFilter === "today") return "Filter by Due Today";
    return `Filter by ${cardFilter}`;
  }, [cardFilter]);

  return (
    <div className="space-y-8 pb-12">
      {/* Header section with Google Clock style title and rep selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between pt-2">
        <div>
          <p className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">{formatDate(today)}</p>
          <h1 className="mt-1 text-3xl sm:text-4xl font-medium tracking-tight text-foreground">
            Today's follow-ups
          </h1>
        </div>

        {/* Controls: Sort By and Rep filters */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Filter Dropdown */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "group flex size-10 items-center justify-center rounded-full transition-all duration-150 cursor-pointer border-0 outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-xs",
                  cardFilter
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-surface-container hover:bg-surface-container-high text-foreground"
                )}
                title={`Filter leads (Currently: ${FILTER_OPTIONS.find((o) => (cardFilter === null && o.id === "all") || cardFilter === o.id)?.label})`}
                aria-label="Filter leads"
              >
                <ArrowUpDown className={cn(
                  "size-4 transition-colors",
                  cardFilter ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                )} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-52 rounded-3xl bg-surface-container-high p-2 border border-surface-container-highest/80 shadow-xl text-foreground flex flex-col gap-1.5"
            >
              {FILTER_OPTIONS.map((opt) => {
                const isSelected = (cardFilter === null && opt.id === "all") || cardFilter === opt.id;
                const Icon = opt.icon;
                return (
                  <DropdownMenuItem
                    key={opt.id}
                    onClick={() => setCardFilter((prev) => (prev === opt.id || opt.id === "all" ? null : opt.id))}
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
                        <Icon className="size-3.5" />
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

          {/* Rep filter as a Material 3 tonal dropdown menu */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="group flex items-center gap-2.5 rounded-full bg-surface-container hover:bg-surface-container-high px-3.5 py-2 text-sm font-medium text-foreground transition-all duration-150 cursor-pointer border-0 outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-xs"
              >
                <div className="grid size-6 place-items-center rounded-full bg-surface-container-highest text-foreground font-semibold text-xs">
                  {rep === "all" ? (
                    <Users className="size-3.5 text-muted-foreground" />
                  ) : (
                    rep.slice(0, 1)
                  )}
                </div>
                <span>{rep === "all" ? `All reps (${reps.length})` : rep}</span>
                <ChevronDown className="size-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 rounded-3xl bg-surface-container-high p-2 border border-surface-container-highest/80 shadow-xl text-foreground flex flex-col gap-1.5"
            >
              <DropdownMenuItem
                onClick={() => setRep("all")}
                className={cn(
                  "flex items-center justify-between rounded-3xl px-3 py-2 text-sm font-medium cursor-pointer transition-colors outline-none",
                  rep === "all"
                    ? "bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground font-semibold"
                    : "text-foreground hover:bg-surface-container-highest focus:bg-surface-container-highest focus:text-foreground"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      "grid size-6 place-items-center rounded-full text-xs font-medium",
                      rep === "all"
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-surface-container-highest text-muted-foreground"
                    )}
                  >
                    <Users className="size-3.5" />
                  </div>
                  <span>All reps</span>
                </div>
                {rep === "all" ? (
                  <Check className="size-4" />
                ) : (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {leads.length}
                  </span>
                )}
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1 bg-surface-container-highest" />

              {reps.map((r) => {
                const repCount = leads.filter((l) => l.rep_name === r).length;
                const isSelected = rep === r;
                return (
                  <DropdownMenuItem
                    key={r}
                    onClick={() => setRep(r)}
                    className={cn(
                      "flex items-center justify-between rounded-3xl px-3 py-2 text-sm font-medium cursor-pointer transition-colors outline-none",
                      isSelected
                        ? "bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground font-semibold"
                        : "text-foreground hover:bg-surface-container-highest focus:bg-surface-container-highest focus:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={cn(
                          "grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                          isSelected
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-surface-container-highest text-foreground"
                        )}
                      >
                        {r.slice(0, 1)}
                      </div>
                      <span className="truncate">{r}</span>
                    </div>
                    {isSelected ? (
                      <Check className="size-4 shrink-0" />
                    ) : (
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {repCount}
                      </span>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Material 3 / Google Clock style Stat Tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat
          label="Overdue"
          value={overdue}
          active={cardFilter === "overdue"}
          onClick={() => handleCardClick("overdue")}
          className="bg-surface-container text-foreground"
        />
        <Stat
          label="Due today"
          value={items.length - overdue}
          active={cardFilter === "today"}
          onClick={() => handleCardClick("today")}
          className={cn(
            items.length - overdue > 0
              ? "bg-today-soft text-today"
              : "bg-surface-container text-foreground"
          )}
        />
        <Stat
          label="Hot leads"
          value={counts.Hot}
          active={cardFilter === "Hot"}
          onClick={() => handleCardClick("Hot")}
          className="bg-hot-soft text-hot"
        />
        <Stat
          label="Warm leads"
          value={counts.Warm}
          active={cardFilter === "Warm"}
          onClick={() => handleCardClick("Warm")}
          className="bg-warm-soft text-warm"
        />
        <Stat
          label="Cold leads"
          value={counts.Cold}
          active={cardFilter === "Cold"}
          onClick={() => handleCardClick("Cold")}
          className="bg-cold-soft text-cold"
        />
      </div>

      {/* Leads List Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              {sectionTitle}
            </h2>
          </div>
          {displayedLeads.length > 0 && (
            <span className="text-xs text-muted-foreground font-mono">
              {filterStatusText}
            </span>
          )}
        </div>

        {displayedLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl bg-surface-container-low p-12 text-center text-muted-foreground">
            <div className="grid size-12 place-items-center rounded-2xl bg-surface-container mb-3 text-primary">
              <CalendarClock className="size-6" />
            </div>
            <p className="text-base font-medium text-foreground">
              {cardFilter ? `No ${cardFilter} leads found` : "All caught up for today"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {cardFilter ? "Try selecting another card or reset the filter." : "No leads currently scheduled for follow-up."}
            </p>
            {cardFilter && (
              <button
                type="button"
                onClick={() => setCardFilter(null)}
                className="mt-4 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer"
              >
                Show today's queue
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-3">
            {displayedLeads.map((l) => {
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

                    <div className="mt-3 space-y-2.5">

                      {/* Combined Gippi AI summary & suggestion card & action buttons row */}
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

                      {a?.status === "failed" && (
                        <p className="flex items-center gap-1.5 text-xs text-destructive font-medium pt-1">
                          <AlertTriangle className="size-3.5" /> Latest analysis failed — click to review
                        </p>
                      )}
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

function Stat({
  label,
  value,
  active,
  onClick,
  className,
}: {
  label: string;
  value: number;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const textClasses = className
    ? className
        .split(" ")
        .filter((c) => !c.startsWith("bg-"))
        .join(" ")
    : "";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "p-5 sm:p-6 text-left cursor-pointer select-none group relative border-0 bg-transparent rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-primary",
        active && "z-10",
        "hover:z-20",
        textClasses
      )}
    >
      {/* Visual card surface that scales on hover/active without zooming the text */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 rounded-3xl border transition-transform duration-150 shadow-xs",
          className,
          active
            ? "border-current/25 scale-[1.015]"
            : "border-transparent group-hover:scale-[1.015] group-active:scale-[0.98]"
        )}
      />

      {/* Smoothly pulsing border when active */}
      {active && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-px rounded-3xl border border-current/60 animate-pulse scale-[1.015]"
        />
      )}

      {/* Content stays static and unscaled */}
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider opacity-75">{label}</p>
        </div>
        <p className="mt-2 text-3xl sm:text-4xl font-normal tracking-tight">{value}</p>
      </div>
    </button>
  );
}
