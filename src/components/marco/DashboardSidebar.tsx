import { useState, memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useLocation } from "@tanstack/react-router";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Home,
  TrendingUp,
  BarChart3,
  Zap,
  ShieldAlert,
  Settings,
  Menu,
  X,
  Activity,
  HelpCircle,
  DollarSign,
  Users,
  ArrowLeft,
} from "lucide-react";
import { Logo } from "./Logo";

const sidebarLinks = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Command Center", href: "/dashboard/command-center", icon: Activity },
  { label: "DEX Trending", href: "/dashboard/dex-trending", icon: TrendingUp },
  { label: "Paid Trending", href: "/dashboard/paid-trending", icon: DollarSign },
  { label: "Live Market", href: "/dashboard/live-market", icon: BarChart3 },
  { label: "Boost Feed", href: "/dashboard/boost-feed", icon: Zap },
  { label: "Community Takeovers", href: "/dashboard/community-takeovers", icon: Users },
  { label: "Rug Scanner", href: "/dashboard/rug-scanner", icon: ShieldAlert },
  { label: "FAQ", href: "/dashboard/faq", icon: HelpCircle },
  { label: "Tools", href: "/dashboard/tools", icon: Settings },
];

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

  const isActive = (href: string) =>
    href === "/dashboard"
      ? location.pathname === "/dashboard" || location.pathname === "/dashboard/"
      : location.pathname.startsWith(href);

  return (
    <>
      {/* mobile trigger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="hairline fixed left-4 top-4 z-[55] grid size-10 place-items-center bg-(--graphite) lg:hidden"
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
      >
        {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
      </button>

      {/* scrim under mobile drawer */}
      <AnimatePresence>
        {mobileOpen && isMobile && (
          <motion.button
            aria-label="Close menu"
            className="fixed inset-0 z-[45] bg-black/60 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        className={`hairline-r fixed left-0 top-0 z-[50] flex h-screen flex-col bg-(--graphite) transition-[width,transform] duration-500 ${
          collapsed ? "w-20" : "w-64"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{ transitionTimingFunction: "cubic-bezier(.16,1,.3,1)" }}
      >
        {/* header */}
        <div className="hairline-b flex h-[72px] items-center justify-between px-5">
          <Link to="/dashboard" aria-label="Dashboard home" className={collapsed ? "mx-auto" : ""}>
            {collapsed ? (
              <img src="/favicon.png" alt="" className="size-7" />
            ) : (
              <Logo sub={false} size={28} />
            )}
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden p-1.5 text-(--faint) transition-colors hover:text-(--bone) lg:block"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu className="size-4" />
          </button>
        </div>

        {/* nav */}
        <nav className="flex-1 overflow-y-auto py-4" aria-label="Dashboard">
          {sidebarLinks.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                to={l.href}
                onClick={() => setMobileOpen(false)}
                className={`relative flex items-center gap-3.5 px-5 py-3 transition-colors duration-300 ${
                  active ? "text-(--bone)" : "text-(--faint) hover:text-(--muted-2)"
                } ${collapsed ? "justify-center px-0" : ""}`}
              >
                <span
                  className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 bg-(--gold) transition-opacity duration-300 ${
                    active ? "opacity-100" : "opacity-0"
                  }`}
                />
                <l.icon className="size-4 shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                {!collapsed && (
                  <span className="font-mono text-[11px] uppercase tracking-[0.12em]">
                    {l.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* footer: quiet return to landing */}
        <div className="hairline-t px-5 py-5">
          <Link
            to="/"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 text-(--faint) transition-colors duration-300 hover:text-(--bone) ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <ArrowLeft className="size-4" />
            {!collapsed && (
              <span className="font-mono text-[10px] tracking-[0.22em]">MARCOVAULT</span>
            )}
          </Link>
        </div>
      </aside>
    </>
  );
}

export const DashboardSidebar = memo(DashboardSidebarComponent);
