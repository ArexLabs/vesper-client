import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";

import { Sidebar } from "@/components/layout/Sidebar";
import { TitleBar } from "@/components/layout/TitleBar";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useLauncherStore } from "@/store/launcher-store";

const SIDEBAR_KEY = "vesper.sidebar-collapsed";

function readBooleanStorage(key: string, fallback: boolean) {
  if (typeof window === "undefined") return fallback;
  const value = window.localStorage.getItem(key);
  if (value === null) return fallback;
  return value === "true";
}

export function AppShell() {
  const boot = useLauncherStore((state) => state.boot);
  const status = useLauncherStore((state) => state.status);
  const error = useLauncherStore((state) => state.error);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    readBooleanStorage(SIDEBAR_KEY, false),
  );

  useEffect(() => {
    void boot();
  }, [boot]);

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
  }

  return (
    <TooltipProvider>
      <div className="h-screen overflow-hidden bg-[#08090b] text-text">
        <div className="flex h-full flex-col">
          <TitleBar />

          <div className="flex min-h-0 flex-1">
            {/* Animate width instead of grid-template-columns */}
            <div
              className={cn(
                "shrink-0 transition-[width] duration-200 ease-linear",
                sidebarCollapsed ? "w-24" : "w-[248px]",
              )}
            >
              <Sidebar collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebar} />
            </div>

            <div className="flex min-w-0 flex-1 flex-col bg-transparent">
              {error ? (
                <div className="bg-danger/10 px-6 py-3 text-sm text-danger">{error}</div>
              ) : null}

              <main className="min-h-0 flex-1 overflow-y-auto px-5 py-5 [scrollbar-gutter:stable_both-edges] md:px-6">
                {status === "loading" ? (
                  <LoadingShell />
                ) : (
                  <div className="mx-auto flex min-h-full w-full max-w-[1180px] flex-col">
                    <Outlet />
                  </div>
                )}
              </main>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

function LoadingShell() {
  return (
    <div className="mx-auto grid w-full max-w-[1180px] gap-4">
      <Skeleton className="h-28 rounded-3xl" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Skeleton className="h-72 rounded-3xl" />
        <Skeleton className="h-72 rounded-3xl" />
      </div>
    </div>
  );
}
