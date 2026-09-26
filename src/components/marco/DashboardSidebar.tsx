import { useEffect, useState, memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useLocation } from "@tanstack/react-router";
import { useIsMobile } from "@/hooks/use-mobile";
import { Home, Menu, X, ArrowLeft } from "lucide-react";
import { Logo } from "./Logo";
import { DUR, EASE } from "@/lib/motion";

const sidebarLinks = [{ label: "Overview", href: "/dashboard", icon: Home }];

/**
 * Icons sit on a fixed 26 px inset in both states, so collapsing (256 → 68 px)
 * never moves them: only the labels fade out, and the width transition clips.
 */
const ROW = "flex items-center gap-3.5 whitespace-nowrap pl-[26px] pr-5";
const LABEL = (collapsed: boolean) =>
  `transition-opacity duration-(--dur-micro) ease-(--ease-snap) ${
    collapsed ? "lg:pointer-events-none lg:opacity-0" : "opacity-100"
  }`;

function DashboardSidebarComponent({
  collapsed,
  setCollapsed,
}: {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();
  const location = useLocation();

  // Escape closes the mobile drawer.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const isActive = (href: string) =>
    href === "/dashboard"
      ? location.pathname === "/dashboard" || location.pathname === "/dashboard/"
      : location.pathname.startsWith(href);

  return (
    <>
      {/* mobile trigger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="mv-glass-icon fixed left-4 top-2 z-[55] grid size-10 place-items-center text-(--bone) lg:hidden"
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        aria-expanded={mobileOpen}
        aria-controls="dashboard-sidebar"
      >
        {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
      </button>

      {/* scrim under mobile drawer */}
      <AnimatePresence>
        {mobileOpen && isMobile && (
          <motion.button
            aria-label="Close menu"
            className="fixed inset-0 z-[45] bg-(--void)/60 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR.standard, ease: EASE.snap }}
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        id="dashboard-sidebar"
        className={`hairline-r fixed left-0 top-0 z-[50] flex h-screen w-64 flex-col overflow-hidden bg-(--graphite) transition-[width,transform] duration-(--dur-structural) ease-(--ease-shift) ${
          collapsed ? "lg:w-[68px]" : ""
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* header */}
        <div className="hairline-b flex h-[72px] items-center justify-between pl-5 pr-4">
          <Link
            to="/dashboard"
            aria-label="Dashboard home"
            className={collapsed ? "lg:hidden" : ""}
          >
            <Logo sub={false} size={28} />
          </Link>
          {collapsed && (
            <Link to="/dashboard" aria-label="Dashboard home" className="hidden lg:block">
              <img src="/favicon.png" alt="" className="size-7" />
            </Link>
          )}
          <button
            onClick={() => setCollapsed(true)}
            className={`hidden p-1.5 text-(--faint) transition-colors duration-(--dur-micro) hover:text-(--bone) ${
              collapsed ? "" : "lg:block"
            }`}
            aria-label="Collapse sidebar"
          >
            <Menu className="size-4" />
          </button>
        </div>
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="hairline-b hidden h-10 w-full place-items-center text-(--faint) transition-colors duration-(--dur-micro) hover:text-(--bone) lg:grid"
            aria-label="Expand sidebar"
          >
            <Menu className="size-4" />
          </button>
        )}

        {/* nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4" aria-label="Dashboard">
          {sidebarLinks.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                to={l.href}
                onClick={() => setMobileOpen(false)}
                aria-current={active ? "page" : undefined}
                title={collapsed ? l.label : undefined}
                className={`relative ${ROW} py-3 transition-colors duration-(--dur-micro) ${
                  active ? "text-(--bone)" : "text-(--faint) hover:text-(--muted-2)"
                }`}
              >
                <span
                  className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 bg-(--gold) transition-opacity duration-(--dur-standard) ${
                    active ? "opacity-100" : "opacity-0"
                  }`}
                />
                <l.icon className="size-4 shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                <span
                  className={`font-mono text-[11px] uppercase tracking-[0.12em] ${LABEL(collapsed)}`}
                >
                  {l.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* footer: quiet return to landing */}
        <div className="hairline-t py-5">
          <Link
            to="/"
            onClick={() => setMobileOpen(false)}
            title={collapsed ? "MARCOVAULT" : undefined}
            className={`${ROW} text-(--faint) transition-colors duration-(--dur-micro) hover:text-(--bone)`}
          >
            <ArrowLeft className="size-4 shrink-0" />
            <span className={`font-mono text-[10px] tracking-[0.22em] ${LABEL(collapsed)}`}>
              MARCOVAULT
            </span>
          </Link>
        </div>
      </aside>
    </>
  );
}

export const DashboardSidebar = memo(DashboardSidebarComponent);
