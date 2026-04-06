import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { argsToMultiline, multilineToArgs, resolveInstanceConfig } from "@/lib/config";
import { t } from "@/lib/i18n";
import { type LauncherConfig, launcherConfigSchema } from "@/lib/schemas";
import { formatDateTime } from "@/lib/utils";
import { useLauncherStore } from "@/store/launcher-store";
import {
  Cpu,
  Download,
  HardDrive,
  MemoryStick,
  Monitor,
  Play,
  RotateCcw,
  Save,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

export function InstanceDetailsPage() {
  const { instanceId } = useParams();
  const data = useLauncherStore((s) => s.data);
  const lang = data.ui.language;
  const applyPresetToInstance = useLauncherStore((s) => s.applyPresetToInstance);
  const saveInstanceResolvedConfig = useLauncherStore((s) => s.saveInstanceResolvedConfig);
  const rollbackInstanceSnapshot = useLauncherStore((s) => s.rollbackInstanceSnapshot);
  const launchInstance = useLauncherStore((s) => s.launchInstance);
  const lastLaunchPreview = useLauncherStore((s) => s.lastLaunchPreview);

  const instance = data.instances.find((i) => i.id === instanceId);
  if (!instance) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Instance not found</CardTitle>
          <CardDescription>The selected instance does not exist.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/instances">{t(lang, "instances")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const effective = resolveInstanceConfig(data, instance);
  const [draft, setDraft] = useState<LauncherConfig>(effective);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setDraft(effective);
  }, [instance.id, JSON.stringify(effective)]);

  const currentPreview = lastLaunchPreview?.instanceId === instance.id ? lastLaunchPreview : null;

  async function saveQuickConfig() {
    const parsed = launcherConfigSchema.safeParse(draft);
    if (!parsed.success) {
      setErr("Quick config is invalid.");
      setMsg(null);
      return;
    }
    const result = await saveInstanceResolvedConfig(
      instance!.id,
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
    <div className="grid gap-6">
      <Card className="glass-card overflow-hidden rounded-2xl border border-white/5">
        <CardHeader className="border-b border-white/5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">{instance.name}</CardTitle>
              <CardDescription>
                {instance.mcVersion} • {instance.loader} •{" "}
                {instance.modpackName ?? "No modpack label"}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="accent">{instance.loader}</Badge>
              <Badge variant="outline" className="border-white/10">
                {instance.snapshots.length} {t(lang, "snapshots")}
              </Badge>
              <Button
                size="lg"
                className="play-button gap-2 rounded-xl px-6"
                onClick={() => void launchInstance(instance.id)}
              >
                <Play className="h-4 w-4" />
                {t(lang, "launchPlaceholder")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 pt-6 lg:grid-cols-[1fr_300px]">
          <div className="grid gap-4 text-sm">
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <span className="text-textMuted">Created</span>
                <span className="font-medium">{formatDateTime(instance.createdAt, lang)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-textMuted">Updated</span>
                <span className="font-medium">{formatDateTime(instance.updatedAt, lang)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-textMuted">{t(lang, "lastPlayed")}</span>
                <span className="font-medium">{formatDateTime(instance.lastPlayedAt, lang)}</span>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <label className="label mb-3 block">{t(lang, "preset")}</label>
            <select
              className="field mb-3 bg-white/[0.02]"
              value={instance.presetId ?? ""}
              onChange={(e) => void applyPresetToInstance(instance.id, e.target.value || null)}
            >
              <option value="">None</option>
              {data.presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
            <Button asChild variant="outline" size="sm" className="w-full rounded-lg border-white/10">
              <Link to={`/config-studio?instance=${instance.id}`}>{t(lang, "configStudio")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass-card overflow-hidden rounded-2xl border border-white/5">
          <CardHeader className="border-b border-white/5 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-brand-accent/10 p-2">
                <Sparkles className="h-5 w-5 text-brand-accent" />
              </div>
              <div>
                <CardTitle className="text-sm">Performance Settings</CardTitle>
                <CardDescription>Quick configuration for this instance</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 pt-4">
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MemoryStick className="h-4 w-4 text-brand-accent" />
                  <span className="text-sm font-medium">Memory Allocation</span>
                </div>
                <span className="font-mono text-sm text-brand-accent">
                  {draft.memoryMbMin} - {draft.memoryMbMax} MB
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs text-textMuted">Minimum</label>
                  <Slider
                    value={[draft.memoryMbMin]}
                    onValueChange={([val]) => setDraft({ ...draft, memoryMbMin: val })}
                    min={512}
                    max={16384}
                    step={256}
                    className="py-2"
                  />
                  <div className="text-center text-xs text-textMuted">{draft.memoryMbMin} MB</div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-textMuted">Maximum</label>
                  <Slider
                    value={[draft.memoryMbMax]}
                    onValueChange={([val]) => setDraft({ ...draft, memoryMbMax: val })}
                    min={1024}
                    max={32768}
                    step={512}
                    className="py-2"
                  />
                  <div className="text-center text-xs text-textMuted">{draft.memoryMbMax} MB</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="mb-3 flex items-center gap-2">
                <Monitor className="h-4 w-4 text-brand-accent" />
                <span className="text-sm font-medium">Display</span>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="label mb-1.5 block">Width</label>
                  <input
                    type="number"
                    className="field bg-white/[0.02]"
                    value={draft.window.width}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        window: { ...draft.window, width: Number(e.target.value || 0) },
                      })
                    }
                  />
                </div>
                <div className="flex-1">
                  <label className="label mb-1.5 block">Height</label>
                  <input
                    type="number"
                    className="field bg-white/[0.02]"
                    value={draft.window.height}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        window: { ...draft.window, height: Number(e.target.value || 0) },
                      })
                    }
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-textMuted">Fullscreen</span>
                <Switch
                  checked={draft.window.fullscreen}
                  onCheckedChange={(checked) =>
                    setDraft({
                      ...draft,
                      window: { ...draft.window, fullscreen: checked },
                    })
                  }
                />
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="mb-3 flex items-center gap-2">
                <Settings className="h-4 w-4 text-brand-accent" />
                <span className="text-sm font-medium">Java Path</span>
              </div>
              <input
                className="field bg-white/[0.02]"
                value={draft.javaPath}
                onChange={(e) => setDraft({ ...draft, javaPath: e.target.value })}
                placeholder="java"
              />
            </div>

            {err ? (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {err}
              </div>
            ) : null}
            {msg ? (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
                {msg}
              </div>
            ) : null}

            <div className="flex gap-2">
              <Button onClick={() => void saveQuickConfig()} className="gap-2">
                <Save className="h-4 w-4" />
                Save Config
              </Button>
              <Button asChild variant="outline" className="gap-2">
                <Link to={`/config-studio?instance=${instance.id}`}>
                  <Sparkles className="h-4 w-4" />
                  {t(lang, "configStudio")}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="glass-card overflow-hidden rounded-2xl border border-white/5">
            <CardHeader className="border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-500/10 p-2">
                  <Cpu className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <CardTitle className="text-sm">Resolved Config</CardTitle>
                  <CardDescription>Effective configuration preview</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid gap-3 text-sm">
                <div className="flex justify-between rounded-lg border border-white/5 bg-white/[0.02] p-2">
                  <span className="text-textMuted">Java</span>
                  <span className="font-mono text-xs text-brand-accent">{effective.javaPath}</span>
                </div>
                <div className="flex justify-between rounded-lg border border-white/5 bg-white/[0.02] p-2">
                  <span className="text-textMuted">Memory</span>
                  <span className="font-mono text-brand-accent">
                    {effective.memoryMbMin}/{effective.memoryMbMax} MB
                  </span>
                </div>
                <div className="flex justify-between rounded-lg border border-white/5 bg-white/[0.02] p-2">
                  <span className="text-textMuted">Window</span>
                  <span className="font-mono text-brand-accent">
                    {effective.window.width}×{effective.window.height}
                    {effective.window.fullscreen ? " fullscreen" : ""}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card overflow-hidden rounded-2xl border border-white/5">
            <CardHeader className="border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-red-500/10 p-2">
                  <X className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <CardTitle className="text-sm">Overrides</CardTitle>
                  <CardDescription>Instance-specific changes</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <pre className="field-mono max-h-48 overflow-auto whitespace-pre-wrap text-xs">
                {JSON.stringify(instance.overrides, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="glass-panel mb-4">
          <TabsTrigger value="overview">{t(lang, "overview")}</TabsTrigger>
          <TabsTrigger value="mods">{t(lang, "mods")}</TabsTrigger>
          <TabsTrigger value="runtime">{t(lang, "runtime")}</TabsTrigger>
          <TabsTrigger value="history">{t(lang, "history")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="glass-card overflow-hidden rounded-2xl border border-white/5">
              <CardHeader className="border-b border-white/5 pb-4">
                <CardTitle>Resolved Config Summary</CardTitle>
                <CardDescription>Global + Preset + Instance diff</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-textMuted">Java</span>
                  <span className="font-mono text-xs">{effective.javaPath}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-textMuted">Memory</span>
                  <span>
                    {effective.memoryMbMin}/{effective.memoryMbMax} MB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-textMuted">Window</span>
                  <span>
                    {effective.window.width}×{effective.window.height}
                    {effective.window.fullscreen ? " • fullscreen" : ""}
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card overflow-hidden rounded-2xl border border-white/5">
              <CardHeader className="border-b border-white/5 pb-4">
                <CardTitle>Overrides (Diff)</CardTitle>
                <CardDescription>Only changed keys are persisted</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="field-mono max-h-64 overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(instance.overrides, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="mods">
          <Card className="glass-card overflow-hidden rounded-2xl border border-white/5">
            <CardHeader className="border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-brand-accent/10 p-2">
                  <Download className="h-5 w-5 text-brand-accent" />
                </div>
              </div>
              <CardTitle>{t(lang, "mods")}</CardTitle>
              <CardDescription>MVP placeholder for future local scanner/catalog.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm text-textMuted">
                No scanned mod list yet.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="runtime">
          <Card className="glass-card overflow-hidden rounded-2xl border border-white/5">
            <CardHeader className="border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <HardDrive className="h-5 w-5 text-blue-500" />
                </div>
              </div>
              <CardTitle>{t(lang, "runtime")}</CardTitle>
              <CardDescription>Whitelist-based launch seam only. No arbitrary exec.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <pre className="field-mono whitespace-pre-wrap rounded-lg border border-white/5 bg-white/[0.02] p-3">{`${effective.javaPath}
${effective.jvmArgs.join(" ")}
-Xms${effective.memoryMbMin}M -Xmx${effective.memoryMbMax}M
<game-jar> ${effective.launchArgs.join(" ")}`}</pre>
              <Button onClick={() => void launchInstance(instance.id)} className="w-fit gap-2">
                <Play className="h-4 w-4" />
                {t(lang, "launchPlaceholder")}
              </Button>
              {currentPreview ? (
                <pre className="field-mono whitespace-pre-wrap rounded-lg border border-white/5 bg-white/[0.02] p-3">
                  {JSON.stringify(currentPreview, null, 2)}
                </pre>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="glass-card overflow-hidden rounded-2xl border border-white/5">
            <CardHeader className="border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-500/10 p-2">
                  <RotateCcw className="h-5 w-5 text-amber-500" />
                </div>
              </div>
              <CardTitle>History & Rollback</CardTitle>
              <CardDescription>Every config change creates a snapshot.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {instance.snapshots.length === 0 ? (
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm text-textMuted">
                  No snapshots yet.
                </div>
              ) : null}
              {instance.snapshots.map((snapshot) => (
                <div
                  key={snapshot.id}
                  className="rounded-xl border border-white/5 bg-white/[0.02] p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{snapshot.note}</div>
                      <div className="text-xs text-textMuted">
                        {formatDateTime(snapshot.createdAt, lang)} • {snapshot.id}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => void rollbackInstanceSnapshot(instance.id, snapshot.id)}
                    >
                      <RotateCcw className="h-3 w-3" />
                      {t(lang, "rollback")}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
