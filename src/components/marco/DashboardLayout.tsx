import { useState, memo } from "react";
import { DashboardSidebar } from "./DashboardSidebar";

function DashboardLayoutComponent({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex">
      <DashboardSidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <main className={`flex-1 transition-all duration-300 ${collapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1800px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

export const DashboardLayout = memo(DashboardLayoutComponent);
