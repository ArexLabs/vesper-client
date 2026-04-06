import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useLauncherStore } from "@/store/launcher-store";
import { Activity, Boxes, Compass, Settings2, SlidersHorizontal } from "lucide-react";
import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

export function AppLayout() {
  const boot = useLauncherStore((s) => s.boot);
  const status = useLauncherStore((s) => s.status);
  const error = useLauncherStore((s) => s.error);
  const instanceCount = useLauncherStore((s) => s.data.instances.length);
  const presetCount = useLauncherStore((s) => s.data.presets.length);
  const lang = useLauncherStore((s) => s.data.ui.language);
  const location = useLocation();

  useEffect(() => {
    void boot();
  }, [boot]);

  const navItems = [
    { to: "/instances", label: t(lang, "navInstances"), icon: Boxes },
    { to: "/discover", label: t(lang, "navDiscover"), icon: Compass },
    { to: "/config-studio", label: t(lang, "navConfigStudio"), icon: SlidersHorizontal },
    { to: "/diagnostics", label: t(lang, "navDiagnostics"), icon: Activity },
    { to: "/settings", label: t(lang, "navSettings"), icon: Settings2 },
  ];

  const pageTitle = (() => {
    if (location.pathname.startsWith("/instances/")) return t(lang, "details");
    const item = navItems.find((i) => location.pathname.startsWith(i.to));
    return item?.label ?? "Vesper";
  })();

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[280px_1fr]">
        <aside className="glass-panel relative flex flex-col border-b border-white/5 md:border-b-0 md:border-r">
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-white/[0.02] to-transparent" />
          <div className="p-4">
            <div className="mb-5">
              <div className="flex items-center gap-3">
                <div className="glow-button grid h-10 w-10 place-items-center rounded-xl">
                  <div className="h-5 w-5 rounded-full bg-gradient-to-br from-white/30 to-white/10" />
                </div>
                <div>
                  <div className="text-sm font-bold tracking-tight">
                    <span className="text-brand-accent">Vesper</span>
                    <span className="ml-1 text-text">Client</span>
                  </div>
                  <div className="text-xs text-textMuted">{t(lang, "productTagline")}</div>
                </div>
              </div>
            </div>

            <nav className="grid gap-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
                        isActive
                          ? "nav-item-active border-brand-accent/30 text-brand-accent"
                          : "border-transparent text-textMuted hover:border-white/10 hover:bg-white/[0.03] hover:text-text",
                      )
                    }
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto p-4">
            <div className="glass-card rounded-xl border border-white/5 p-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-textMuted">
                  {t(lang, "instances")}
                </span>
                <Badge variant="accent">{instanceCount}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-textMuted">
                  {t(lang, "presets")}
                </span>
                <Badge variant="muted">{presetCount}</Badge>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
              <div className="status-indicator status-online" />
              <span className="text-xs text-textMuted">System Online</span>
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-10 glass-panel border-b border-white/5 px-4 py-3 md:px-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold tracking-tight">{pageTitle}</h1>
                <p className="text-xs text-textMuted">Twilight UI • peach accents • EN/DE</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1.5">
                  <div className="status-indicator status-online" />
                  <span className="text-xs font-medium text-textMuted">Ready</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1.5">
                  <span className="kbd border-white/10 bg-white/5 text-white/50">Zod</span>
                  <span className="kbd border-white/10 bg-white/5 text-white/50">Zustand</span>
                  <span className="kbd border-white/10 bg-white/5 text-white/50">Tauri</span>
                </div>
              </div>
            </div>
          </header>

          {error ? (
            <div className="mx-4 mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger md:mx-6">
              {error}
            </div>
          ) : null}

          <main className="flex-1 px-4 py-4 md:px-6 md:py-6">
            {status === "loading" ? (
              <div className="grid min-h-[50vh] place-items-center">
                <div className="panel w-full max-w-md p-6 text-center">
                  <div className="mb-2 text-sm font-semibold">Initializing Vesper</div>
                  <div className="text-sm text-textMuted">
                    Loading state and validating schemas…
                  </div>
                </div>
              </div>
            ) : (
              <Outlet />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
