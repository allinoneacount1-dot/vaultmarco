import { useState, memo } from "react";
import { DashboardSidebar } from "./DashboardSidebar";
import { GasTracker } from "./GasTracker";

function DashboardLayoutComponent({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-(--void)">
      <DashboardSidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <main
        className={`flex-1 transition-[margin] duration-500 ${collapsed ? "lg:ml-20" : "lg:ml-64"}`}
        style={{ transitionTimingFunction: "cubic-bezier(.16,1,.3,1)" }}
      >
        {/* topbar */}
        <div className="hairline-b sticky top-0 z-[30] flex h-[56px] items-center justify-between bg-(--void)/95 px-4 pl-16 sm:px-6 lg:pl-8">
          <span className="mono-label hidden sm:block">VAULT://INTELLIGENCE DESK</span>
          <div className="flex items-center gap-4">
            <GasTracker />
            <span className="mono-label flex items-center gap-2 text-[9px]! text-(--gold)!">
              <span className="size-1 rounded-full bg-(--gold)" /> LIVE
            </span>
          </div>
        </div>
        <div className="mx-auto max-w-[1800px] p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

export const DashboardLayout = memo(DashboardLayoutComponent);
