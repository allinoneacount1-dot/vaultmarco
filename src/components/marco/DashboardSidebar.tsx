import { useState, memo } from "react";
import { motion } from "framer-motion";
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
  Plus,
  Activity,
  LogOut,
  HelpCircle,
  DollarSign,
  Users,
} from "lucide-react";
import { Logo } from "./Logo";
import { GasTracker } from "./GasTracker";
import { WhaleAlertIcon } from "./WhaleAlertIcon";
import { ThemeToggle } from "./ThemeToggle";
import { ConnectButton } from "@rainbow-me/rainbowkit";

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
    setCollapsed 
  }: { 
    collapsed: boolean; 
    setCollapsed: (collapsed: boolean) => void; 
  }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();
  const location = useLocation();

  const isActive = (href: string) => {
    return location.pathname === href || 
           (href === '/dashboard' && location.pathname.startsWith('/dashboard/'));
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <motion.button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg glass-strong border border-white/10"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
      </motion.button>

      {/* Sidebar */}
      <motion.aside
        className={`fixed left-0 top-0 h-screen bg-gradient-to-b from-background to-background/95 border-r border-white/10 z-40 ${
          collapsed ? "w-20" : "w-64"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        initial={{ x: -300, opacity: 0 }}
        animate={{ x: mobileOpen || !isMobile ? 0 : -300, opacity: 1 }}
        transition={{ 
          type: "spring", 
          stiffness: 260, 
          damping: 20,
          duration: 0.5 
        }}
      >
        {/* Sidebar Header */}
        <motion.div 
          className="p-6 border-b border-white/5 flex items-center justify-between"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          {!collapsed && (
            <Link to="/dashboard" className="flex items-center gap-2">
              <Logo />
            </Link>
          )}
          {collapsed && <Logo />}
          <motion.button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:block p-1.5 rounded-lg hover:bg-white/5 transition-colors text-muted-foreground"
            whileHover={{ scale: 1.1, rotate: 10 }}
            whileTap={{ scale: 0.9 }}
          >
            <Menu className="size-4" />
          </motion.button>
        </motion.div>

        {/* Quick Actions */}
        <motion.div 
          className="p-4 border-b border-white/5"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
            <GasTracker />
            <WhaleAlertIcon />
            <ThemeToggle />
          </div>
        </motion.div>

        {/* Navigation Links */}
      <motion.nav 
        className="p-4 space-y-2 flex-1 overflow-y-auto"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        {sidebarLinks.map((link, index) => {
          const Icon = link.icon;
          return (
            <motion.div
              key={link.href}
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.07, duration: 0.5 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Link
                to={link.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive(link.href)
                    ? "bg-primary/20 text-primary border border-primary/30 glow-cyan"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent"
                }`}
              >
                <motion.div
                  animate={isActive(link.href) ? { 
                    rotate: [0, 5, -5, 0],
                    scale: [1, 1.1, 1] 
                  } : {}}
                  transition={{ 
                    duration: 2,
                    repeat: Infinity,
                    repeatDelay: 3
                  }}
                >
                  <Icon className="size-5" />
                </motion.div>
                {!collapsed && (
                  <span className="text-[13px] font-medium tracking-wide">{link.label}</span>
                )}
              </Link>
            </motion.div>
          );
        })}
      </motion.nav>

      {/* Exit Dashboard Link */}
      <motion.div 
        className="p-4 border-t border-white/10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.5 }}
      >
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Link
            to="/"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200 border border-transparent"
          >
            <LogOut className="size-5" />
            {!collapsed && (
              <span className="text-[13px] font-medium tracking-wide">Exit Dashboard</span>
            )}
          </Link>
        </motion.div>
      </motion.div>

      {/* Connect Wallet Button */}
      <motion.div 
        className="p-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.5 }}
      >
          <ConnectButton.Custom>
            {({ account, openConnectModal, mounted }) => {
              if (!mounted) return null;

              if (!account) {
                return (
                  <motion.button
                    onClick={openConnectModal}
                    className="w-full group relative inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-[12px] font-medium text-primary-foreground tracking-wider uppercase transition-all hover:scale-[1.02] glow-cyan overflow-hidden"
                    whileHover={{ 
                      scale: 1.05,
                      boxShadow: "0 0 20px rgba(145, 231, 255, 0.5)"
                    }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {!collapsed && <span>Connect Wallet</span>}
                    {collapsed && <Plus className="size-5" />}
                  </motion.button>
                );
              }

              return <ConnectButton />;
            }}
          </ConnectButton.Custom>
        </motion.div>
      </motion.aside>
    </>
  );
}

export const DashboardSidebar = memo(DashboardSidebarComponent);
