"use client";

import { useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { AppTopBar } from "./AppTopBar";
import { AISidebar } from "@/components/ai/AISidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-surface-0 overflow-hidden">
      <AppSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppTopBar
          aiSidebarOpen={aiSidebarOpen}
          onToggleAiSidebar={() => setAiSidebarOpen((o) => !o)}
        />
        <main className="flex-1 overflow-y-auto bg-surface-0">{children}</main>
      </div>
      <AISidebar
        isOpen={aiSidebarOpen}
        onClose={() => setAiSidebarOpen(false)}
      />
    </div>
  );
}
