import { Link, useRouterState } from "@tanstack/react-router";
import { ThemeToggle } from "./ThemeToggle";
import { AppIcon } from "./AppIcon";

export function AppHeader() {
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  const pageTitle =
    pathname === "/"
      ? "Today's Follow-Ups"
      : pathname === "/leads"
        ? "All Leads"
        : pathname === "/leads/new"
          ? "Add New Lead"
          : "Lead Details";

  return (
    <header className="sticky top-0 z-20 h-16 shrink-0 flex items-center bg-background/85 backdrop-blur-md transition-colors px-4 sm:px-8 border-0">
      <div className="relative flex w-full items-center justify-between gap-4">
        {/* Left: Mobile brand (mobile) */}
        <div className="flex items-center gap-3">
          <Link to="/" className="md:hidden flex items-center gap-1.5">
            <AppIcon className="size-[30px] shrink-0" />
            <span className="text-[24px] font-bold tracking-tight text-foreground lowercase leading-none">
              gushpack
            </span>
          </Link>
        </div>

        {/* Center: Workspace / Page Title Breadcrumb */}
        <div className="absolute left-1/2 -translate-x-1/2 hidden sm:flex items-center gap-2 text-sm text-muted-foreground pointer-events-none select-none">
          <span>Workspace</span>
          <span className="opacity-40">/</span>
          <span className="font-medium text-foreground">{pageTitle}</span>
        </div>

        {/* Right side header actions */}
        <div className="flex items-center gap-2.5">
          <ThemeToggle variant="icon" />
        </div>
      </div>
    </header>
  );
}
