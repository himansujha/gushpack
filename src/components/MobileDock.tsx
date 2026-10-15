import { useState, useRef, useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Home, Plus, Users } from "lucide-react";
import { leadsQuery, todaysFollowUps } from "@/lib/lead-queries";
import { useToday } from "@/hooks/use-today";
import { cn } from "@/lib/utils";

function HomeSolid({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 21v-8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v8z"
      />
    </svg>
  );
}

function UsersSolid({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M4.5 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM14.25 8.625a3.375 3.375 0 1 1 6.75 0 3.375 3.375 0 0 1-6.75 0ZM1.5 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122ZM17.25 19.128l-.001.144a2.25 2.25 0 0 1-.233.96 10.088 10.088 0 0 0 5.06-1.01.75.75 0 0 0 .42-.643 4.875 4.875 0 0 0-6.957-4.611 8.586 8.586 0 0 1 1.71 5.157v.003Z" />
    </svg>
  );
}

export function MobileDock() {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const dockRef = useRef<HTMLDivElement>(null);

  const today = useToday();
  const { data: leads = [] } = useQuery(leadsQuery);
  const routerState = useRouterState();

  const currentPath = routerState.location.pathname;
  const queue = todaysFollowUps(leads, today);

  const isLeadDetail = currentPath.startsWith("/leads/") && currentPath !== "/leads/new";
  const currentMobileMenu = !isLeadDetail
    ? currentPath === "/"
      ? "workspace"
      : currentPath === "/leads"
        ? "all-leads"
        : null
    : null;

  const [activeMobileMenu, setActiveMobileMenu] = useState<string>(() => {
    if (currentMobileMenu) return currentMobileMenu;
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("gushpack_active_dock_menu") || "workspace";
    }
    return "workspace";
  });

  useEffect(() => {
    if (currentMobileMenu) {
      setActiveMobileMenu(currentMobileMenu);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("gushpack_active_dock_menu", currentMobileMenu);
      }
    }
  }, [currentMobileMenu]);

  const isWorkspace = isLeadDetail ? activeMobileMenu === "workspace" : currentPath === "/";
  const isAllLeads = isLeadDetail ? activeMobileMenu === "all-leads" : currentPath === "/leads";

  // Reset visibility on route changes
  useEffect(() => {
    setIsVisible(true);
    lastScrollY.current = typeof window !== "undefined" ? window.scrollY : 0;
  }, [currentPath]);

  // Scroll listener: Hide when scrolling down, show when scrolling up
  useEffect(() => {
    if (typeof window === "undefined") return;

    const threshold = 12;
    const topThreshold = 40;

    const handleScroll = () => {
      // Strictly do nothing on desktop devices
      if (window.innerWidth >= 768) return;

      const currentScrollY = window.scrollY;

      // Always show at top of page
      if (currentScrollY <= topThreshold) {
        setIsVisible(true);
        lastScrollY.current = currentScrollY;
        return;
      }

      const diff = currentScrollY - lastScrollY.current;

      // Ignore micro jitters
      if (Math.abs(diff) < threshold) {
        return;
      }

      if (diff > 0) {
        // Scrolling down -> hide dock to give maximum reading area
        setIsVisible(false);
      } else {
        // Scrolling up -> reveal dock for navigation
        setIsVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 md:!hidden">
      {/* Floating Menu Dock Container - 3 buttons: Home, Plus (Center), All Leads */}
      <nav
        ref={dockRef}
        aria-label="Mobile Navigation Dock"
        className={cn(
          "p-3 flex items-center gap-3 rounded-full bg-surface-container-low/95 dark:bg-surface-container-lowest/95 backdrop-blur-2xl border border-outline-variant/40 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.4)] dark:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8)] select-none transition-[transform,opacity] duration-300 ease-out",
          isVisible
            ? "translate-y-0 opacity-100 pointer-events-auto"
            : "translate-y-36 opacity-0 pointer-events-none"
        )}
      >
        {/* Workspace / Home */}
        <Link
          to="/"
          aria-label="Workspace"
          className={cn(
            "relative flex shrink-0 items-center justify-center size-16 rounded-full transition-all duration-150 active:scale-95",
            isWorkspace
              ? "text-foreground hover:bg-surface-container/60"
              : "text-muted-foreground hover:text-foreground hover:bg-surface-container/60"
          )}
        >
          {isWorkspace ? (
            <HomeSolid className="size-7" />
          ) : (
            <Home className="size-7 stroke-[2]" />
          )}
        </Link>

        {/* Center + Quick Action for Adding New Lead */}
        <Link
          to="/leads/new"
          aria-label="Add new lead"
          className={cn(
            "flex shrink-0 items-center justify-center size-16 rounded-full transition-all duration-150 active:scale-95 cursor-pointer shadow-md",
            currentPath === "/leads/new"
              ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-surface-container-low"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          <Plus className="size-8 stroke-[2.5]" />
        </Link>

        {/* All Leads */}
        <Link
          to="/leads"
          aria-label="All Leads"
          className={cn(
            "relative flex shrink-0 items-center justify-center size-16 rounded-full transition-all duration-150 active:scale-95",
            isAllLeads
              ? "text-foreground hover:bg-surface-container/60"
              : "text-muted-foreground hover:text-foreground hover:bg-surface-container/60"
          )}
        >
          {isAllLeads ? (
            <UsersSolid className="size-7" />
          ) : (
            <Users className="size-7 stroke-[2]" />
          )}
        </Link>
      </nav>
    </div>
  );
}
