import { queryOptions } from "@tanstack/react-query";
import { getLead, listLeads, listReps, type LeadSummary } from "./leads.functions";

export const leadsQuery = queryOptions({ queryKey: ["leads"], queryFn: () => listLeads() });
export const repsQuery = queryOptions({ queryKey: ["reps"], queryFn: () => listReps(), staleTime: Infinity });
export const leadQuery = (id: string) =>
  queryOptions({ queryKey: ["lead", id], queryFn: () => getLead({ data: { id } }) });

/** Local calendar date as YYYY-MM-DD. */
export function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  const date = new Date(d.length === 10 ? d + "T00:00:00" : d);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}

export type DueState = "overdue" | "today" | "upcoming" | "none";
export function dueState(next: string | null | undefined, today: string): DueState {
  if (!next) return "none";
  if (next < today) return "overdue";
  if (next === today) return "today";
  return "upcoming";
}

const CLASS_RANK = { Hot: 0, Warm: 1, Cold: 2 } as const;

/** Today's follow-ups: overdue first, then due today; urgent and Hot first within each group. */
export function todaysFollowUps(leads: LeadSummary[], today: string) {
  return leads
    .filter((l) => {
      const a = l.analysis;
      if (!a || a.do_not_contact) return false;
      const s = dueState(a.next_follow_up_date, today);
      return s === "overdue" || s === "today";
    })
    .sort((x, y) => {
      const a = x.analysis!, b = y.analysis!;
      const sa = dueState(a.next_follow_up_date, today) === "overdue" ? 0 : 1;
      const sb = dueState(b.next_follow_up_date, today) === "overdue" ? 0 : 1;
      if (sa !== sb) return sa - sb;
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      const ca = CLASS_RANK[a.classification ?? "Cold"], cb = CLASS_RANK[b.classification ?? "Cold"];
      if (ca !== cb) return ca - cb;
      return (a.next_follow_up_date ?? "").localeCompare(b.next_follow_up_date ?? "");
    });
}

const URGENT_PROMPTS = [
  "Please send this urgent follow-up message.",
  "Time-sensitive follow-up waiting to be sent:",
  "Please prioritize sending this response to the buyer:",
];

const HOT_PROMPTS = [
  "Please send this follow-up to keep the deal moving.",
  "Recommended follow-up message to secure the next step:",
  "Please share this follow-up with the buyer:",
  "Suggested response to finalize the requirement:",
];

const WARM_PROMPTS = [
  "Please check in with this follow-up message.",
  "Here is a gentle nudge to stay on their radar:",
  "Suggested check-in to nurture this lead:",
  "Please share this follow-up to keep momentum going:",
];

const COLD_PROMPTS = [
  "Consider reconnecting with this brief message.",
  "Here is a gentle re-engagement message to try:",
  "Suggested check-in to revive the conversation:",
];

export function getFollowUpInstruction(
  analysis: {
    action_prompt?: string | null;
    draft_edited?: boolean;
    urgent?: boolean;
    classification?: string | null;
  } | null | undefined,
  seed?: string,
): string {
  if (!analysis) return "Please send this follow-up message.";
  if (analysis.draft_edited) return "Rep edited draft message to send:";
  if (analysis.action_prompt && analysis.action_prompt.trim().length > 0) {
    const p = analysis.action_prompt.trim();
    return p.endsWith(".") || p.endsWith(":") ? p : `${p}.`;
  }
  // Deterministic seed based on lead id to provide natural variety
  const hash = seed
    ? Math.abs(seed.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0))
    : 0;

  if (analysis.urgent) {
    return URGENT_PROMPTS[hash % URGENT_PROMPTS.length] ?? "Please send this urgent follow-up message.";
  }
  if (analysis.classification === "Hot") {
    return HOT_PROMPTS[hash % HOT_PROMPTS.length] ?? "High priority deal follow-up:";
  }
  if (analysis.classification === "Warm") {
    return WARM_PROMPTS[hash % WARM_PROMPTS.length] ?? "Follow-up recommended to keep momentum:";
  }
  if (analysis.classification === "Cold") {
    return COLD_PROMPTS[hash % COLD_PROMPTS.length] ?? "Re-engagement check-in prompt:";
  }
  return "Please send this follow-up message.";
}

