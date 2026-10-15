import { cn } from "@/lib/utils";
import type { AnalysisRow, Classification } from "@/lib/leads.functions";

const CLASS_STYLE: Record<Classification, string> = {
  Hot: "bg-hot-soft text-hot",
  Warm: "bg-warm-soft text-warm",
  Cold: "bg-cold-soft text-cold",
};

export function ClassBadge({ value, className }: { value: Classification | null | undefined; className?: string }) {
  if (!value) return <span className="text-xs text-muted-foreground">Not analysed</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium tracking-wide",
        CLASS_STYLE[value],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-80" />
      {value}
    </span>
  );
}

export function OverdueBadge({ days }: { days: number }) {
  return (
    <span className="inline-flex items-center rounded-full bg-overdue-soft px-3 py-0.5 text-xs font-semibold text-overdue">
      Overdue {days > 0 ? `· ${days}d` : ""}
    </span>
  );
}

export function SourceTag({ analysis }: { analysis: AnalysisRow | null }) {
  if (!analysis || analysis.status === "pending") {
    return <span className="inline-flex items-center rounded-full bg-surface-container px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Analysing…</span>;
  }
  if (analysis.source === "ai") {
    return <span className="inline-flex items-center rounded-full bg-primary-container px-2.5 py-0.5 text-xs font-medium text-on-primary-container">Live AI analysis</span>;
  }
  if (analysis.source === "fallback") {
    return <span className="inline-flex items-center rounded-full bg-warm-soft px-2.5 py-0.5 text-xs font-medium text-warm">Rule-based</span>;
  }
  return null;
}
