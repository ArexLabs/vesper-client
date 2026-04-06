import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLauncherStore } from "@/store/launcher-store";
import {
  Activity,
  Cpu,
  Download,
  HardDrive,
  MemoryStick,
  Play,
  Plus,
  TrendingUp,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

export function HomePage() {
  const lang = useLauncherStore((state) => state.data.ui.language);
  const instances = useLauncherStore((state) => state.data.instances);
  const profiles = useLauncherStore((state) => state.data.profiles);

  const lastPlayedInstances = [...instances]
    .sort((left, right) => {
      const leftKey = left.lastPlayedAt ?? left.updatedAt ?? left.createdAt;
      const rightKey = right.lastPlayedAt ?? right.updatedAt ?? right.createdAt;
      return rightKey.localeCompare(leftKey);
    })
    .slice(0, 4);

  const mcProfile = profiles.find((p) => p.provider === "microsoft");
  const isSignedIn = mcProfile?.authState === "signed_in";
  const username = mcProfile?.minecraftUsername ?? mcProfile?.displayName ?? "Not signed in";

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="glass-card overflow-hidden rounded-2xl border border-white/5">
          <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500/20 via-green-500/10 to-transparent p-6">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjAyIi8+PC9nPjwvc3ZnPg==')] opacity-30" />
            <div className="relative">
              <div className="mb-1 flex items-center gap-2">
                <div className="status-indicator status-online" />
                <span className="text-xs font-medium uppercase tracking-wider text-emerald-400">
                  Ready to Play
                </span>
              </div>
              <h2 className="mb-2 text-2xl font-bold tracking-tight text-text">
                Welcome to Vesper
              </h2>
              <p className="mb-6 max-w-md text-sm text-textMuted">
                Your Minecraft gaming command center. Launch your favorite instances or explore
                new mods.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button className="play-button gap-2 rounded-xl px-6 py-2.5 font-semibold" asChild>
                  <Link to="/instances">
                    <Play className="h-4 w-4" />
                    Play Now
                  </Link>
                </Button>
                <Button variant="outline" className="gap-2 rounded-xl border-white/10" asChild>
                  <Link to="/discover">
                    <Download className="h-4 w-4" />
                    Browse Mods
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <Card className="glass-card overflow-hidden rounded-2xl border border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4 text-brand-accent" />
                Account
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-accent/20 to-brand-accent/5">
                  <Users className="h-5 w-5 text-brand-accent" />
                </div>
                <div>
                  <div className="font-medium text-text">{username}</div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <div
                      className={`status-indicator ${isSignedIn ? "status-online" : "status-offline"}`}
                    />
                    <span className="text-textMuted">
                      {isSignedIn ? "Signed in" : "Not signed in"}
                    </span>
                  </div>
                </div>
              </div>
              {!isSignedIn && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full rounded-lg border-white/10"
                  asChild
                >
                  <Link to="/settings">Sign In</Link>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card overflow-hidden rounded-2xl border border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Activity className="h-4 w-4 text-brand-accent" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-textMuted">
                    <Cpu className="h-3.5 w-3.5" />
                    CPU
                  </span>
                  <span className="font-mono text-brand-accent">12%</span>
                </div>
                <div className="stat-bar">
                  <div className="stat-bar-fill" style={{ width: "12%" }} />
                </div>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-textMuted">
                    <MemoryStick className="h-3.5 w-3.5" />
                    RAM
                  </span>
                  <span className="font-mono text-brand-accent">2.4 GB</span>
                </div>
                <div className="stat-bar">
                  <div className="stat-bar-fill" style={{ width: "24%" }} />
                </div>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-textMuted">
                    <HardDrive className="h-3.5 w-3.5" />
                    Disk
                  </span>
                  <span className="font-mono text-brand-accent">45%</span>
                </div>
                <div className="stat-bar">
                  <div className="stat-bar-fill" style={{ width: "45%" }} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="glass-card overflow-hidden rounded-2xl border border-white/5 lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="h-4 w-4 text-brand-accent" />
              Recent Instances
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs" asChild>
              <Link to="/instances">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {lastPlayedInstances.length === 0 ? (
              <div className="py-8 text-center">
                <p className="mb-4 text-sm text-textMuted">No instances yet</p>
                <Button className="gap-2 rounded-xl" asChild>
                  <Link to="/instances">
                    <Plus className="h-4 w-4" />
                    Create Instance
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {lastPlayedInstances.map((instance) => (
                  <Link
                    key={instance.id}
                    to={`/instances/${instance.id}`}
                    className="group flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition-all hover:border-brand-accent/30 hover:bg-white/[0.04]"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-brand-accent/20 to-brand-accent/5">
                      <Play className="h-4 w-4 text-brand-accent" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="truncate font-medium text-text">{instance.name}</div>
                      <div className="text-xs text-textMuted">
                        {instance.mcVersion} • {instance.loader}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={(e) => e.preventDefault()}
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card overflow-hidden rounded-2xl border border-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Activity className="h-4 w-4 text-brand-accent" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <div>
                <div className="text-2xl font-bold metric-value">{instances.length}</div>
                <div className="text-xs text-textMuted">Total Instances</div>
              </div>
              <div className="rounded-lg bg-brand-accent/10 p-2">
                <TrendingUp className="h-5 w-5 text-brand-accent" />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <div>
                <div className="text-2xl font-bold metric-value">
                  {instances.filter((i) => i.lastPlayedAt).length}
                </div>
                <div className="text-xs text-textMuted">Played Sessions</div>
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <Play className="h-5 w-5 text-emerald-500" />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <div>
                <div className="text-2xl font-bold metric-value">
                  {profiles.filter((p) => p.provider === "microsoft").length}
                </div>
                <div className="text-xs text-textMuted">Accounts</div>
              </div>
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="glass-card overflow-hidden rounded-2xl border border-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Activity className="h-4 w-4 text-brand-accent" />
              Latest News
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="group cursor-pointer rounded-lg border border-white/5 bg-white/[0.02] p-3 transition-all hover:border-brand-accent/30">
              <div className="mb-1 text-xs text-brand-accent">Minecraft 1.21.4 Released</div>
              <div className="text-sm text-textMuted">
                New features, bug fixes, and performance improvements...
              </div>
            </div>
            <div className="group cursor-pointer rounded-lg border border-white/5 bg-white/[0.02] p-3 transition-all hover:border-brand-accent/30">
              <div className="mb-1 text-xs text-brand-accent">Fabric 0.16.0 Available</div>
              <div className="text-sm text-textMuted">
                Latest Fabric loader brings improved mod loading...
              </div>
            </div>
            <div className="group cursor-pointer rounded-lg border border-white/5 bg-white/[0.02] p-3 transition-all hover:border-brand-accent/30">
              <div className="mb-1 text-xs text-brand-accent">Vesper Client Update</div>
              <div className="text-sm text-textMuted">
                New dashboard design and improved performance...
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card overflow-hidden rounded-2xl border border-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Download className="h-4 w-4 text-brand-accent" />
              Downloads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Download className="mx-auto mb-3 h-8 w-8 text-textMuted" />
              <p className="text-sm text-textMuted">No active downloads</p>
              <Button variant="outline" size="sm" className="mt-4 rounded-lg" asChild>
                <Link to="/discover">Browse Mods</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}