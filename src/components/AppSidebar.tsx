import { useState, useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  CalendarClock,
  Clock,
  Flame,
  Snowflake,
  SunMedium,
  Users,
  Plus,
  X,
} from "lucide-react";
import { leadsQuery, todaysFollowUps, dueState } from "@/lib/lead-queries";
import { useToday } from "@/hooks/use-today";
import { AppIcon } from "./AppIcon";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const today = useToday();
  const { data: leads = [] } = useQuery(leadsQuery);
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const currentSearch = (routerState.location.search as { filter?: string }) || {};

  const isLeadDetail = currentPath.startsWith("/leads/") && currentPath !== "/leads/new";

  const currentPrimaryMenu = (() => {
    if (!isLeadDetail) {
      if (currentPath === "/") return "workspace";
      if (currentPath === "/leads") {
        if (!currentSearch.filter) return "all-leads";
        if (currentSearch.filter === "Overdue") return "overdue";
        if (currentSearch.filter === "Due Today") return "due-today";
        if (currentSearch.filter === "Hot") return "hot";
        if (currentSearch.filter === "Warm") return "warm";
        if (currentSearch.filter === "Cold") return "cold";
      }
      if (currentPath === "/leads/new") return "add-lead";
    }
    return null;
  })();

  const [activeMenu, setActiveMenu] = useState<string>(() => {
    if (currentPrimaryMenu) return currentPrimaryMenu;
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("gushpack_active_menu") || "workspace";
    }
    return "workspace";
  });

  useEffect(() => {
    if (currentPrimaryMenu) {
      setActiveMenu(currentPrimaryMenu);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("gushpack_active_menu", currentPrimaryMenu);
      }
    }
  }, [currentPrimaryMenu]);

  const queue = todaysFollowUps(leads, today);
  const overdueCount = leads.filter(
    (l) => l.analysis && !l.analysis.do_not_contact && dueState(l.analysis.next_follow_up_date, today) === "overdue"
  ).length;
  const dueTodayCount = leads.filter(
    (l) => l.analysis && !l.analysis.do_not_contact && dueState(l.analysis.next_follow_up_date, today) === "today"
  ).length;
  const hotCount = leads.filter((l) => l.analysis?.classification === "Hot").length;
  const warmCount = leads.filter((l) => l.analysis?.classification === "Warm").length;
  const coldCount = leads.filter((l) => l.analysis?.classification === "Cold").length;

  const sidebarContent = (
    <aside className="flex h-full w-72 flex-col bg-surface-container-low px-4 pb-4 sm:px-5 sm:pb-5 transition-colors select-none">
      {/* Brand Header - exactly h-16 flex items-center to align with navbar row */}
      <div className="flex h-16 items-center justify-between px-2 shrink-0">
        <Link to="/" className="flex items-center gap-1.5">
          <AppIcon className="size-7 shrink-0" />
          <span className="text-[22px] font-bold tracking-tight text-foreground lowercase leading-none">
            gushpack
          </span>
        </Link>
      </div>

      {/* Primary Action: Add Lead Stadium Pill - aligned with workspace title block */}
      <div className="pt-8 pb-5">
        <Link
          to="/leads/new"
         
          className={cn(
            "flex w-full h-[60px] items-center justify-center gap-2.5 rounded-full px-5 font-semibold text-primary-foreground shadow-none transition-all text-base cursor-pointer active:scale-[0.99]",
            currentPath === "/leads/new"
              ? "bg-primary ring-2 ring-primary ring-offset-2 ring-offset-surface-container-low"
              : "bg-primary hover:bg-primary/90"
          )}
        >
          <Plus className="size-5 stroke-[2.5]" />
          <span>Add Leads</span>
        </Link>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 space-y-6 overflow-y-auto pr-1">
        {/* Menu Navigation */}
        <div>
          <p className="px-3.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Menu
          </p>
          <nav className="space-y-2">
            {/* Workspace */}
            <Link
              to="/"
              className={cn(
                "group flex items-center justify-between rounded-full pl-4 pr-1.5 py-2 text-sm font-medium transition-colors",
                activeMenu === "workspace"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-foreground hover:bg-surface-container",
              )}
            >
              <div className="flex items-center gap-3">
                <CalendarClock className={cn(
                  "size-4 shrink-0 transition-colors",
                  activeMenu === "workspace" ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                )} />
                <span>Workspace</span>
              </div>
              <span className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums leading-none",
                activeMenu === "workspace"
                  ? "bg-primary-foreground/15 text-primary-foreground"
                  : "bg-surface-container text-foreground"
              )}>
                {queue.length}
              </span>
            </Link>

            {/* All Leads */}
            <Link
              to="/leads"
              className={cn(
                "group flex items-center justify-between rounded-full pl-4 pr-1.5 py-2 text-sm font-medium transition-colors",
                activeMenu === "all-leads"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-foreground hover:bg-surface-container",
              )}
            >
              <div className="flex items-center gap-3">
                <Users className={cn(
                  "size-4 shrink-0 transition-colors",
                  activeMenu === "all-leads" ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                )} />
                <span>All Leads</span>
              </div>
              <span className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums leading-none",
                activeMenu === "all-leads" ? "bg-primary-foreground/15 text-primary-foreground" : "bg-surface-container text-foreground"
              )}>
                {leads.length}
              </span>
            </Link>
            {/* Overdue */}
            <Link
              to="/leads"
              search={{ filter: "Overdue" }}
              className={cn(
                "group flex items-center justify-between rounded-full pl-4 pr-1.5 py-2 text-sm font-medium transition-colors",
                activeMenu === "overdue"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-foreground hover:bg-surface-container",
              )}
            >
              <div className="flex items-center gap-3">
                <Clock className={cn(
                  "size-4 shrink-0 transition-colors",
                  activeMenu === "overdue" ? "text-primary-foreground" : "text-overdue"
                )} />
                <span>Overdue</span>
              </div>
              <span className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums leading-none",
                activeMenu === "overdue" ? "bg-primary-foreground/15 text-primary-foreground" : "bg-overdue-soft text-overdue"
              )}>
                {overdueCount}
              </span>
            </Link>

            {/* Due Today */}
            <Link
              to="/leads"
              search={{ filter: "Due Today" }}
              className={cn(
                "group flex items-center justify-between rounded-full pl-4 pr-1.5 py-2 text-sm font-medium transition-colors",
                activeMenu === "due-today"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-foreground hover:bg-surface-container",
              )}
            >
              <div className="flex items-center gap-3">
                <CalendarClock className={cn(
                  "size-4 shrink-0 transition-colors",
                  activeMenu === "due-today" ? "text-primary-foreground" : "text-today"
                )} />
                <span>Due Today</span>
              </div>
              <span className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums leading-none",
                activeMenu === "due-today" ? "bg-primary-foreground/15 text-primary-foreground" : "bg-today-soft text-today"
              )}>
                {dueTodayCount}
              </span>
            </Link>

            {/* Hot Leads */}
            <Link
              to="/leads"
              search={{ filter: "Hot" }}
              className={cn(
                "group flex items-center justify-between rounded-full pl-4 pr-1.5 py-2 text-sm font-medium transition-colors",
                activeMenu === "hot"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-foreground hover:bg-surface-container",
              )}
            >
              <div className="flex items-center gap-3">
                <Flame className={cn(
                  "size-4 shrink-0 transition-colors",
                  activeMenu === "hot" ? "text-primary-foreground" : "text-hot"
                )} />
                <span>Hot Leads</span>
              </div>
              <span className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums leading-none",
                activeMenu === "hot" ? "bg-primary-foreground/15 text-primary-foreground" : "bg-hot-soft text-hot"
              )}>
                {hotCount}
              </span>
            </Link>

            {/* Warm Leads */}
            <Link
              to="/leads"
              search={{ filter: "Warm" }}
              className={cn(
                "group flex items-center justify-between rounded-full pl-4 pr-1.5 py-2 text-sm font-medium transition-colors",
                activeMenu === "warm"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-foreground hover:bg-surface-container",
              )}
            >
              <div className="flex items-center gap-3">
                <SunMedium className={cn(
                  "size-4 shrink-0 transition-colors",
                  activeMenu === "warm" ? "text-primary-foreground" : "text-warm"
                )} />
                <span>Warm Leads</span>
              </div>
              <span className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums leading-none",
                activeMenu === "warm" ? "bg-primary-foreground/15 text-primary-foreground" : "bg-warm-soft text-warm"
              )}>
                {warmCount}
              </span>
            </Link>

            {/* Cold Leads */}
            <Link
              to="/leads"
              search={{ filter: "Cold" }}
              className={cn(
                "group flex items-center justify-between rounded-full pl-4 pr-1.5 py-2 text-sm font-medium transition-colors",
                activeMenu === "cold"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-foreground hover:bg-surface-container",
              )}
            >
              <div className="flex items-center gap-3">
                <Snowflake className={cn(
                  "size-4 shrink-0 transition-colors",
                  activeMenu === "cold" ? "text-primary-foreground" : "text-cold"
                )} />
                <span>Cold Leads</span>
              </div>
              <span className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums leading-none",
                activeMenu === "cold" ? "bg-primary-foreground/15 text-primary-foreground" : "bg-cold-soft text-cold"
              )}>
                {coldCount}
              </span>
            </Link>
          </nav>
        </div>
      </div>

    </aside>
  );  return (
    <div className="hidden md:flex h-full shrink-0">
      {sidebarContent}
    </div>
  );
}
