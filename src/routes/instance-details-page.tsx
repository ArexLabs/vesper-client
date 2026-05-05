import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Play, RotateCcw } from "lucide-react";
import { argsToMultiline, multilineToArgs, resolveInstanceConfig } from "@/lib/config";
import { t } from "@/lib/i18n";
import { launcherConfigSchema, type LauncherConfig } from "@/lib/schemas";
import { formatDateTime } from "@/lib/utils";
import { useLauncherStore } from "@/store/launcher-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">{instance.name}</CardTitle>
              <CardDescription>
                {instance.mcVersion} • {instance.loader} •{" "}
                {instance.modpackName ?? "No modpack label"}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="accent">{instance.loader}</Badge>
              <Badge variant="muted">
                {instance.snapshots.length} {t(lang, "snapshots")}
              </Badge>
              <Button size="sm" onClick={() => void launchInstance(instance.id)}>
                <Play className="h-4 w-4" />
                {t(lang, "launchPlaceholder")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[1fr_280px]">
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-textMuted">Created</span>
              <span>{formatDateTime(instance.createdAt, lang)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-textMuted">Updated</span>
              <span>{formatDateTime(instance.updatedAt, lang)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-textMuted">{t(lang, "lastPlayed")}</span>
              <span>{formatDateTime(instance.lastPlayedAt, lang)}</span>
            </div>
          </div>
          <div className="panel-soft p-3">
            <label className="label mb-2 block">{t(lang, "preset")}</label>
            <select
              className="field mb-3"
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
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link to={`/config-studio?instance=${instance.id}`}>{t(lang, "configStudio")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t(lang, "overview")}</TabsTrigger>
          <TabsTrigger value="mods">{t(lang, "mods")}</TabsTrigger>
          <TabsTrigger value="config">{t(lang, "config")}</TabsTrigger>
          <TabsTrigger value="runtime">{t(lang, "runtime")}</TabsTrigger>
          <TabsTrigger value="history">{t(lang, "history")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
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
            <Card>
              <CardHeader>
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
          <Card>
            <CardHeader>
              <CardTitle>{t(lang, "mods")}</CardTitle>
              <CardDescription>MVP placeholder for future local scanner/catalog.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="panel-soft p-3 text-sm text-textMuted">No scanned mod list yet.</div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader>
                <CardTitle>Quick Config Editor</CardTitle>
                <CardDescription>Safe form edits for common fields.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="label">Java Path</label>
                    <input
                      className="field mt-1"
                      value={draft.javaPath}
                      onChange={(e) => setDraft({ ...draft, javaPath: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Min MB</label>
                      <input
                        type="number"
                        className="field mt-1"
                        value={draft.memoryMbMin}
                        onChange={(e) =>
                          setDraft({ ...draft, memoryMbMin: Number(e.target.value || 0) })
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Max MB</label>
                      <input
                        type="number"
                        className="field mt-1"
                        value={draft.memoryMbMax}
                        onChange={(e) =>
                          setDraft({ ...draft, memoryMbMax: Number(e.target.value || 0) })
                        }
                      />
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="label">Width</label>
                    <input
                      type="number"
                      className="field mt-1"
                      value={draft.window.width}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          window: { ...draft.window, width: Number(e.target.value || 0) },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Height</label>
                    <input
                      type="number"
                      className="field mt-1"
                      value={draft.window.height}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          window: { ...draft.window, height: Number(e.target.value || 0) },
                        })
                      }
                    />
                  </div>
                  <label className="mt-6 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.window.fullscreen}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          window: { ...draft.window, fullscreen: e.target.checked },
                        })
                      }
                    />
                    Fullscreen
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="label">JVM Args</label>
                    <textarea
                      className="field-mono mt-1 min-h-[100px]"
                      value={argsToMultiline(draft.jvmArgs)}
                      onChange={(e) =>
                        setDraft({ ...draft, jvmArgs: multilineToArgs(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Renderer Flags</label>
                    <textarea
                      className="field-mono mt-1 min-h-[100px]"
                      value={argsToMultiline(draft.rendererFlags)}
                      onChange={(e) =>
                        setDraft({ ...draft, rendererFlags: multilineToArgs(e.target.value) })
                      }
                    />
                  </div>
                </div>
                {err ? (
                  <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                    {err}
                  </div>
                ) : null}
                {msg ? (
                  <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                    {msg}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void saveQuickConfig()}>Save Quick Config</Button>
                  <Button asChild variant="outline">
                    <Link to={`/config-studio?instance=${instance.id}`}>
                      {t(lang, "configStudio")}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Effective Config JSON</CardTitle>
                <CardDescription>Read-only preview</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="field-mono max-h-[520px] overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(effective, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="runtime">
          <Card>
            <CardHeader>
              <CardTitle>{t(lang, "runtime")}</CardTitle>
              <CardDescription>
                Whitelist-based launch seam only. No arbitrary exec.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <pre className="field-mono whitespace-pre-wrap">{`${effective.javaPath}\n${effective.jvmArgs.join(" ")}\n-Xms${effective.memoryMbMin}M -Xmx${effective.memoryMbMax}M\n<game-jar> ${effective.launchArgs.join(" ")}`}</pre>
              <Button onClick={() => void launchInstance(instance.id)} className="w-fit">
                <Play className="h-4 w-4" />
                {t(lang, "launchPlaceholder")}
              </Button>
              {currentPreview ? (
                <pre className="field-mono whitespace-pre-wrap">
                  {JSON.stringify(currentPreview, null, 2)}
                </pre>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>History & Rollback</CardTitle>
              <CardDescription>Every config change creates a snapshot.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {instance.snapshots.length === 0 ? (
                <div className="panel-soft p-3 text-sm text-textMuted">No snapshots yet.</div>
              ) : null}
              {instance.snapshots.map((snapshot) => (
                <div key={snapshot.id} className="panel-soft p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">{snapshot.note}</div>
                      <div className="text-xs text-textMuted">
                        {formatDateTime(snapshot.createdAt, lang)} • {snapshot.id}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void rollbackInstanceSnapshot(instance.id, snapshot.id)}
                    >
                      <RotateCcw className="h-4 w-4" />
                      {t(lang, "rollback")}
                    </Button>
                  </div>
                  <details>
                    <summary className="cursor-pointer text-xs text-textMuted">Payload</summary>
                    <pre className="field-mono mt-2 max-h-60 overflow-auto whitespace-pre-wrap">
                      {JSON.stringify(snapshot, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
