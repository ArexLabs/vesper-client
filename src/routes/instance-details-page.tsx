import { DiscoverModsSection } from "@/components/discover/DiscoverModsSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { argsToMultiline, multilineToArgs, resolveInstanceConfig } from "@/lib/config";
import { useT } from "@/lib/i18n";
import { type LauncherConfig, launcherConfigSchema } from "@/lib/schemas";
import { cn, formatDateTime } from "@/lib/utils";
import { useLauncherStore } from "@/store/launcher-store";
import { AnimatePresence, motion } from "framer-motion";
import {
  Clock,
  Compass,
  FolderOpen,
  History,
  Package2,
  Play,
  RotateCcw,
  Settings2,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

export function InstanceDetailsPage() {
  const { instanceId } = useParams();
  const navigate = useNavigate();
  const data = useLauncherStore((s) => s.data);
  const { t, i18n } = useT();
  const applyPresetToInstance = useLauncherStore((s) => s.applyPresetToInstance);
  const saveInstanceResolvedConfig = useLauncherStore((s) => s.saveInstanceResolvedConfig);
  const rollbackInstanceSnapshot = useLauncherStore((s) => s.rollbackInstanceSnapshot);
  const launchInstance = useLauncherStore((s) => s.launchInstance);
  const lastLaunchPreview = useLauncherStore((s) => s.lastLaunchPreview);

  const instance = data.instances.find((i) => i.id === instanceId);
  const effective = instance ? resolveInstanceConfig(data, instance) : null;

  const [draft, setDraft] = useState<LauncherConfig | null>(effective);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (effective) {
      setDraft(effective);
    }
  }, [effective]);

  if (!instance || !effective || !draft) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Instance not found</CardTitle>
            <CardDescription>The selected instance does not exist.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/">{t("instances")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentInstance = instance;
  const currentPreview =
    lastLaunchPreview?.instanceId === currentInstance.id ? lastLaunchPreview : null;

  async function saveQuickConfig() {
    const parsed = launcherConfigSchema.safeParse(draft);
    if (!parsed.success) {
      setErr("Quick config is invalid.");
      setMsg(null);
      return;
    }
    const result = await saveInstanceResolvedConfig(
      currentInstance.id,
      parsed.data,
      "Quick config tab save",
    );
    if (result.ok) {
      setMsg("Saved. Snapshot created.");
      setErr(null);
    } else {
      setErr(result.issues?.join(" | ") ?? result.error);
      setMsg(null);
    }
  }

  return (
    <div className="space-y-6 motion-preset-fade motion-duration-500">
      {/* Premium Header */}
      <Card className="overflow-hidden border-none bg-surface1 shadow-panel">
        <div className="flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-center">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="grid h-16 w-16 sm:h-20 sm:w-20 shrink-0 place-items-center rounded-2xl sm:rounded-3xl border border-border bg-surface2 text-primary shadow-inner">
              <Package2 className="h-8 w-8 sm:h-10 sm:w-10" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h1 className="truncate text-xl sm:text-2xl font-bold tracking-tight text-white">
                  {instance.name}
                </h1>
                <Badge
                  variant="outline"
                  className="border-primary/20 bg-primary/5 text-primary text-[10px] sm:text-xs"
                >
                  {instance.loader}
                </Badge>
              </div>
              <p className="mt-1 truncate text-xs sm:text-sm text-textMuted">
                Minecraft {instance.mcVersion}
                {instance.modpackName ? ` · ${instance.modpackName}` : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 lg:ml-auto">
            <div className="flex h-10 sm:h-12 items-center gap-1.5 rounded-xl sm:rounded-2xl border border-border bg-surface2/50 px-3">
              <Clock className="h-3.5 w-3.5 text-textMuted" />
              <div className="text-[10px] sm:text-sm">
                <span className="hidden sm:inline text-textMuted">Last played: </span>
                <span className="font-medium text-text">
                  {formatDateTime(instance.lastPlayedAt, i18n.language)}
                </span>
              </div>
            </div>
            <Button
              size="lg"
              className="h-10 sm:h-12 flex-1 sm:flex-initial rounded-xl sm:rounded-2xl px-6 sm:px-8 font-bold shadow-lg shadow-primary/20"
              onClick={() => void launchInstance(instance.id)}
            >
              <Play className="mr-2 h-4 w-4 sm:h-5 sm:w-5 fill-current" />
              PLAY
            </Button>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="overview" className="w-full">
        <div className="w-full overflow-x-auto pb-2 scrollbar-none">
          <TabsList className="h-12 inline-flex w-max min-w-full justify-start gap-1 bg-surface1/50 p-1 backdrop-blur-sm">
            <TabsTrigger value="overview" className="rounded-xl px-4">
              Overview
            </TabsTrigger>
            <TabsTrigger value="mods" className="rounded-xl px-4">
              Mods
            </TabsTrigger>
            <TabsTrigger value="resourcepacks" className="rounded-xl px-4">
              Resource Packs
            </TabsTrigger>
            <TabsTrigger value="worlds" className="rounded-xl px-4">
              Worlds
            </TabsTrigger>
            <TabsTrigger value="config" className="rounded-xl px-4">
              {t("config")}
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-xl px-4">
              {t("history")}
            </TabsTrigger>
          </TabsList>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key="tabs-content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="mt-6"
          >
            <TabsContent value="overview" className="mt-0 outline-none">
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">About Instance</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-textMuted leading-relaxed">
                        {instance.notes || "No notes provided for this instance."}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-2xl border border-border bg-surface2 p-4 transition-all hover:bg-surface3/40">
                          <p className="text-xs font-semibold uppercase tracking-wider text-textMuted/60">
                            Loader
                          </p>
                          <p className="mt-1 text-lg font-black text-primary">{instance.loader}</p>
                        </div>
                        <div className="rounded-2xl border border-border bg-surface2 p-4 transition-all hover:bg-surface3/40">
                          <p className="text-xs font-semibold uppercase tracking-wider text-textMuted/60">
                            Version
                          </p>
                          <p className="mt-1 text-lg font-black text-white">{instance.mcVersion}</p>
                        </div>
                        <div className="rounded-2xl border border-border bg-surface2 p-4 transition-all hover:bg-surface3/40">
                          <p className="text-xs font-semibold uppercase tracking-wider text-textMuted/60">
                            Playtime
                          </p>
                          <p className="mt-1 text-lg font-black text-white">12.4h</p>
                        </div>
                        <div className="rounded-2xl border border-border bg-surface2 p-4 transition-all hover:bg-surface3/40">
                          <p className="text-xs font-semibold uppercase tracking-wider text-textMuted/60">
                            Storage
                          </p>
                          <p className="mt-1 text-lg font-black text-white">1.2 GB</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-surface1/60 border-primary/5">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <RotateCcw className="size-4 text-primary" />
                        Recent Activity
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between py-2 border-b border-white/5">
                        <span className="text-sm text-textMuted">Last Crash</span>
                        <span className="text-sm font-bold text-success">None</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-white/5">
                        <span className="text-sm text-textMuted">Last Launch</span>
                        <span className="text-sm font-bold text-white">
                          {formatDateTime(instance.lastPlayedAt, i18n.language)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">System Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {currentPreview ? (
                        <div className="rounded-2xl border border-border bg-surface2/50 p-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "h-3 w-3 rounded-full animate-pulse",
                                currentPreview.status === "launcher-opened"
                                  ? "bg-green-500"
                                  : "bg-primary",
                              )}
                            />
                            <span className="font-semibold">
                              {currentPreview.status === "launcher-opened"
                                ? "Game Running"
                                : "Launching..."}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-textMuted">
                            Status Code: {currentPreview.status}
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 text-textMuted">
                          <div className="h-3 w-3 rounded-full bg-surface3" />
                          <span>Ready to play</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-2">
                      <Button
                        variant="outline"
                        className="justify-start rounded-xl"
                        onClick={() => navigate(`/config-studio?instance=${instance.id}`)}
                      >
                        <Settings2 className="mr-2 h-4 w-4" />
                        Full Config Studio
                      </Button>
                      <Button variant="outline" className="justify-start rounded-xl">
                        <FolderOpen className="mr-2 h-4 w-4" />
                        Open Folder
                      </Button>
                      <Button
                        variant="outline"
                        className="justify-start rounded-xl text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Instance
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{t("preset")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Label htmlFor="overview-preset-select" className="sr-only">
                        Preset Selection
                      </Label>
                      <select
                        id="overview-preset-select"
                        className="field w-full rounded-xl"
                        value={instance.presetId || ""}
                        onChange={(e) =>
                          void applyPresetToInstance(instance.id, e.target.value || null)
                        }
                      >
                        <option value="">None</option>
                        {data.presets.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-3 text-xs text-textMuted leading-relaxed">
                        Presets allow you to quickly apply a group of settings to multiple
                        instances.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="mods" className="mt-0 outline-none">
              <DiscoverModsSection
                compact
                initialGameVersion={instance.mcVersion}
                initialLoader={instance.loader}
              />
            </TabsContent>

            <TabsContent value="resourcepacks" className="mt-0 outline-none">
              <Card className="flex flex-col h-64 items-center justify-center border-dashed bg-surface2/30 text-textMuted">
                <div className="text-center p-6">
                  <Package2 className="mx-auto h-12 w-12 opacity-20" />
                  <p className="mt-4 font-bold text-white">Resource Pack Manager</p>
                  <p className="text-xs mt-1">Management UI is under construction.</p>
                  <Button variant="outline" className="mt-6 rounded-xl gap-2">
                    <FolderOpen className="size-4" />
                    Open Resource Packs Folder
                  </Button>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="worlds" className="mt-0 outline-none">
              <Card className="flex flex-col h-64 items-center justify-center border-dashed bg-surface2/30 text-textMuted">
                <div className="text-center p-6">
                  <Compass className="mx-auto h-12 w-12 opacity-20" />
                  <p className="mt-4 font-bold text-white">World Manager</p>
                  <p className="text-xs mt-1">Singleplayer world management coming soon.</p>
                  <Button variant="outline" className="mt-6 rounded-xl gap-2">
                    <FolderOpen className="size-4" />
                    Open Saves Folder
                  </Button>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="config" className="mt-0 outline-none">
              <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle>Memory & Path</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="mem-min">Min Memory (MB)</Label>
                        <Input
                          id="mem-min"
                          type="number"
                          className="rounded-xl"
                          value={draft.memoryMbMin}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              memoryMbMin: Number(e.target.value || 0),
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="mem-max">Max Memory (MB)</Label>
                        <Input
                          id="mem-max"
                          type="number"
                          className="rounded-xl"
                          value={draft.memoryMbMax}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              memoryMbMax: Number(e.target.value || 0),
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="java-path">Java Executable Path</Label>
                      <Input
                        id="java-path"
                        className="rounded-xl"
                        value={draft.javaPath}
                        onChange={(e) => setDraft({ ...draft, javaPath: e.target.value })}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Window</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="win-width">Width</Label>
                        <Input
                          id="win-width"
                          type="number"
                          value={draft.window.width}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              window: {
                                ...draft.window,
                                width: Number(e.target.value || 0),
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="win-height">Height</Label>
                        <Input
                          id="win-height"
                          type="number"
                          value={draft.window.height}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              window: {
                                ...draft.window,
                                height: Number(e.target.value || 0),
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <input
                        id="win-fullscreen"
                        type="checkbox"
                        checked={draft.window.fullscreen}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            window: {
                              ...draft.window,
                              fullscreen: e.target.checked,
                            },
                          })
                        }
                      />
                      <Label htmlFor="win-fullscreen" className="cursor-pointer">
                        Fullscreen
                      </Label>
                    </div>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Arguments</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="jvm-args">JVM Arguments</Label>
                      <textarea
                        id="jvm-args"
                        className="field-mono h-32 min-h-[100px] w-full rounded-xl bg-surface2 p-3 text-sm"
                        value={argsToMultiline(draft.jvmArgs)}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            jvmArgs: multilineToArgs(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="renderer-flags">Renderer Flags</Label>
                      <textarea
                        id="renderer-flags"
                        className="field-mono h-32 min-h-[100px] w-full rounded-xl bg-surface2 p-3 text-sm"
                        value={argsToMultiline(draft.rendererFlags)}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            rendererFlags: multilineToArgs(e.target.value),
                          })
                        }
                      />
                    </div>
                  </CardContent>
                </Card>

                <div className="lg:col-span-3 flex flex-col gap-4">
                  {err && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                      {err}
                    </div>
                  )}
                  {msg && (
                    <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-500">
                      {msg}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <Button onClick={() => void saveQuickConfig()} className="rounded-xl px-8">
                      Save Changes
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => navigate(`/config-studio?instance=${instance.id}`)}
                    >
                      Full Editor
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-0 outline-none">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>{t("snapshots")}</CardTitle>
                    <CardDescription>
                      Roll back your configuration to any previous state.
                    </CardDescription>
                  </div>
                  <Badge variant="outline">{instance.snapshots.length} available</Badge>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-3">
                      {instance.snapshots.length === 0 ? (
                        <div className="flex h-32 flex-col items-center justify-center gap-1 text-textMuted">
                          <History className="h-8 w-8 opacity-20" />
                          <p>No snapshots yet</p>
                        </div>
                      ) : (
                        [...instance.snapshots].reverse().map((snap) => (
                          <div
                            key={snap.id}
                            className="flex items-center justify-between rounded-2xl border border-border bg-surface2/50 p-4"
                          >
                            <div>
                              <p className="font-semibold">{snap.note || "Auto-snapshot"}</p>
                              <p className="text-xs text-textMuted">
                                {formatDateTime(snap.createdAt, i18n.language)}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="rounded-xl"
                              onClick={() => void rollbackInstanceSnapshot(instance.id, snap.id)}
                            >
                              Rollback
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </motion.div>
        </AnimatePresence>
      </Tabs>
    </div>
  );
}
