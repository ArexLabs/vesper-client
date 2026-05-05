import { Activity, Boxes, Compass, Settings2, SlidersHorizontal } from "lucide-react";
import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useLauncherStore } from "@/store/launcher-store";

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
        <aside className="border-b border-border bg-surface1/95 p-4 md:border-b-0 md:border-r">
          <div className="mb-5">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl border border-accent/30 bg-accent/10">
                <div className="h-4 w-4 rounded-full border border-accent/40 bg-accent/50" />
              </div>
              <div>
                <div className="text-sm font-bold tracking-tight">
                  <span className="text-accent">Vesper</span>
                  <span className="ml-1 text-text">Client</span>
                </div>
                <div className="text-xs text-textMuted">{t(lang, "productTagline")}</div>
              </div>
            </div>
          </div>

          <nav className="grid gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm font-medium transition",
                      isActive
                        ? "border-accent/25 bg-accent/10 text-text"
                        : "border-transparent text-textMuted hover:border-border hover:bg-surface2 hover:text-text",
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="mt-6 grid gap-2 rounded-lg border border-borderSoft bg-surface2/60 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-textMuted">{t(lang, "instances")}</span>
              <Badge variant="accent">{instanceCount}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-textMuted">{t(lang, "presets")}</span>
              <Badge variant="muted">{presetCount}</Badge>
            </div>
            <div className="text-textMuted">Snapshots & rollback enabled</div>
          </div>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-10 border-b border-border bg-bg/80 px-4 py-3 backdrop-blur md:px-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold tracking-tight">{pageTitle}</h1>
                <p className="text-xs text-textMuted">Twilight UI • peach accents • EN/DE</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="kbd">Zod</span>
                <span className="kbd">Zustand</span>
                <span className="kbd">Tauri</span>
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
                  <div className="text-sm text-textMuted">Loading state and validating schemas…</div>
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
