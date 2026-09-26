import { useState, memo } from "react";
import { MotionConfig } from "framer-motion";
import { DashboardSidebar } from "./DashboardSidebar";
import { GasTracker } from "./GasTracker";
import { GlobalSearch } from "./GlobalSearch";
import { DeskStatus } from "./desk";

function DashboardLayoutComponent({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    // reducedMotion="user": framer-motion drops transform motion when the OS asks.
    <MotionConfig reducedMotion="user">
      <div className="mv-desk flex min-h-screen bg-(--void)">
        <DashboardSidebar collapsed={collapsed} setCollapsed={setCollapsed} />
        <main
          className={`min-w-0 flex-1 transition-[margin] duration-(--dur-structural) ease-(--ease-shift) ${
            collapsed ? "lg:ml-[68px]" : "lg:ml-64"
          }`}
        >
          {/* topbar: persistent system status */}
          <div className="hairline-b sticky top-0 z-[30] flex h-[56px] items-center justify-between bg-(--void)/95 px-4 pl-16 sm:px-6 lg:pl-8">
            <span className="mono-label hidden sm:block">VAULT://INTELLIGENCE DESK</span>
            <div className="flex items-center gap-3 sm:gap-4">
              <GlobalSearch />
              <GasTracker />
              <DeskStatus />
            </div>
          </div>
          <div className="mx-auto max-w-[1800px] p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </MotionConfig>
  );
}

export const DashboardLayout = memo(DashboardLayoutComponent);
