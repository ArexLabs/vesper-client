import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { argsToMultiline, multilineToArgs } from "@/lib/config";
import { t } from "@/lib/i18n";
import { fetchMinecraftVersions } from "@/lib/minecraft-catalog";
import { type LauncherConfig, formatZodIssues, launcherConfigPatchSchema } from "@/lib/schemas";
import { downloadJson, formatDateTime, readTextFile } from "@/lib/utils";
import { useLauncherStore } from "@/store/launcher-store";
import { Cpu, HardDrive, Monitor, Save, Settings, Upload, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export function SettingsPage() {
  const data = useLauncherStore((s) => s.data);
  const lang = data.ui.language;
  const updateGlobalDefaults = useLauncherStore((s) => s.updateGlobalDefaults);
  const savePresetPatch = useLauncherStore((s) => s.savePresetPatch);
  const rollbackSettingsSnapshot = useLauncherStore((s) => s.rollbackSettingsSnapshot);
  const setLanguage = useLauncherStore((s) => s.setLanguage);
  const exportPresetJson = useLauncherStore((s) => s.exportPresetJson);
  const importPresetJson = useLauncherStore((s) => s.importPresetJson);

  const [globalDraft, setGlobalDraft] = useState<LauncherConfig>(data.globalDefaults);
  const [globalMsg, setGlobalMsg] = useState<string | null>(null);
  const [globalErr, setGlobalErr] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(data.presets[0]?.id ?? "");
  const selectedPreset =
    data.presets.find((p) => p.id === selectedPresetId) ?? data.presets[0] ?? null;
  const [presetJson, setPresetJson] = useState("{}");
  const [presetMsg, setPresetMsg] = useState<string | null>(null);
  const [presetErr, setPresetErr] = useState<string | null>(null);
  const [versions, setVersions] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const result = await fetchMinecraftVersions(40);
        if (active) setVersions(result.map((v) => v.id));
      } catch {
        // ignore
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => setGlobalDraft(data.globalDefaults), [JSON.stringify(data.globalDefaults)]);
  useEffect(() => {
    if (!selectedPreset) return;
    setPresetJson(JSON.stringify(selectedPreset.configPatch, null, 2));
    setPresetMsg(null);
    setPresetErr(null);
  }, [selectedPreset?.id, JSON.stringify(selectedPreset?.configPatch)]);

  const presetValidation = useMemo(() => {
    try {
      const parsed = JSON.parse(presetJson);
      const checked = launcherConfigPatchSchema.safeParse(parsed);
      if (!checked.success)
        return { parsed: null, parseError: null, errors: formatZodIssues(checked.error.issues) };
      return { parsed: checked.data, parseError: null, errors: [] as string[] };
    } catch (error) {
      return {
        parsed: null,
        parseError: error instanceof Error ? error.message : "Invalid JSON",
        errors: [] as string[],
      };
    }
  }, [presetJson]);

  async function saveGlobal() {
    const result = await updateGlobalDefaults(globalDraft);
    if (result.ok) {
      setGlobalMsg("Global defaults saved. Settings snapshot created.");
      setGlobalErr(null);
    } else {
      setGlobalErr(result.issues?.join(" | ") ?? result.error);
      setGlobalMsg(null);
    }
  }

  async function savePreset() {
    if (!selectedPreset) return;
    const result = await savePresetPatch(
      selectedPreset.id,
      presetValidation.parsed,
      "Preset patch saved",
    );
    if (result.ok) {
      setPresetMsg("Preset saved. Settings snapshot created.");
      setPresetErr(null);
    } else {
      setPresetErr(result.issues?.join(" | ") ?? result.error);
      setPresetMsg(null);
    }
  }

  async function importPreset(file: File) {
    const text = await readTextFile(file);
    const result = await importPresetJson(text);
    if (result.ok) {
      setPresetMsg("Preset imported successfully.");
      setPresetErr(null);
    } else {
      setPresetErr(result.issues?.join(" | ") ?? result.error);
      setPresetMsg(null);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-6">
          <Card className="glass-card overflow-hidden rounded-2xl border border-white/5">
            <CardHeader className="border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-brand-accent/10 p-2">
                  <Zap className="h-5 w-5 text-brand-accent" />
                </div>
                <div>
                  <CardTitle>{t(lang, "globalDefaults")}</CardTitle>
                  <CardDescription>Java, Memory, JVM Args, Renderer Flags, Window and Launch Args.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-6 pt-6">
              <div className="grid gap-5">
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-brand-accent" />
                      <span className="text-sm font-medium">Memory Allocation</span>
                    </div>
                    <span className="font-mono text-sm text-brand-accent">
                      {globalDraft.memoryMbMin} - {globalDraft.memoryMbMax} MB
                    </span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs text-textMuted">Minimum</label>
                      <Slider
                        value={[globalDraft.memoryMbMin]}
                        onValueChange={([val]) => setGlobalDraft({ ...globalDraft, memoryMbMin: val })}
                        min={512}
                        max={16384}
                        step={256}
                        className="py-2"
                      />
                      <div className="flex justify-between text-xs text-textMuted">
                        <span>512 MB</span>
                        <span>{globalDraft.memoryMbMin} MB</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-textMuted">Maximum</label>
                      <Slider
                        value={[globalDraft.memoryMbMax]}
                        onValueChange={([val]) => setGlobalDraft({ ...globalDraft, memoryMbMax: val })}
                        min={1024}
                        max={32768}
                        step={512}
                        className="py-2"
                      />
                      <div className="flex justify-between text-xs text-textMuted">
                        <span>1 GB</span>
                        <span>{globalDraft.memoryMbMax} MB</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Settings className="h-4 w-4 text-brand-accent" />
                      <span className="text-sm font-medium">Java Path</span>
                    </div>
                    <input
                      className="field bg-white/[0.02]"
                      value={globalDraft.javaPath}
                      onChange={(e) => setGlobalDraft({ ...globalDraft, javaPath: e.target.value })}
                      placeholder="java"
                    />
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-brand-accent" />
                      <span className="text-sm font-medium">Resolution</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        className="field bg-white/[0.02]"
                        value={globalDraft.window.width}
                        onChange={(e) =>
                          setGlobalDraft({
                            ...globalDraft,
                            window: { ...globalDraft.window, width: Number(e.target.value || 0) },
                          })
                        }
                        placeholder="Width"
                      />
                      <span className="flex items-center text-textMuted">×</span>
                      <input
                        type="number"
                        className="field bg-white/[0.02]"
                        value={globalDraft.window.height}
                        onChange={(e) =>
                          setGlobalDraft({
                            ...globalDraft,
                            window: { ...globalDraft.window, height: Number(e.target.value || 0) },
                          })
                        }
                        placeholder="Height"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-brand-accent" />
                      <span className="text-sm font-medium">Display Mode</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={globalDraft.window.fullscreen}
                        onCheckedChange={(checked) =>
                          setGlobalDraft({
                            ...globalDraft,
                            window: { ...globalDraft.window, fullscreen: checked },
                          })
                        }
                      />
                      <span className="text-xs text-textMuted">Fullscreen</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="label mb-2 block">JVM Args</label>
                  <textarea
                    className="field-mono min-h-[120px] bg-white/[0.02]"
                    value={argsToMultiline(globalDraft.jvmArgs)}
                    onChange={(e) =>
                      setGlobalDraft({ ...globalDraft, jvmArgs: multilineToArgs(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <label className="label mb-2 block">Renderer Flags</label>
                  <textarea
                    className="field-mono min-h-[120px] bg-white/[0.02]"
                    value={argsToMultiline(globalDraft.rendererFlags)}
                    onChange={(e) =>
                      setGlobalDraft({
                        ...globalDraft,
                        rendererFlags: multilineToArgs(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <label className="label mb-2 block">Launch Args</label>
                  <textarea
                    className="field-mono min-h-[120px] bg-white/[0.02]"
                    value={argsToMultiline(globalDraft.launchArgs)}
                    onChange={(e) =>
                      setGlobalDraft({ ...globalDraft, launchArgs: multilineToArgs(e.target.value) })
                    }
                  />
                </div>
              </div>

              {globalMsg ? (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
                  {globalMsg}
                </div>
              ) : null}
              {globalErr ? (
                <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {globalErr}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void saveGlobal()} className="gap-2">
                  <Save className="h-4 w-4" />
                  {t(lang, "saveGlobalDefaults")}
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() =>
                    downloadJson("vesper-global-defaults.json", {
                      schema: "vesper/global-defaults/v1",
                      globalDefaults: globalDraft,
                    })
                  }
                >
                  <Upload className="h-4 w-4" />
                  {t(lang, "export")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card overflow-hidden rounded-2xl border border-white/5">
            <CardHeader className="border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <Cpu className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <CardTitle>Performance Presets</CardTitle>
                  <CardDescription>Quick performance configurations</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid gap-3 md:grid-cols-3">
                <button
                  type="button"
                  className="group rounded-xl border border-white/5 bg-white/[0.02] p-4 text-left transition-all hover:border-brand-accent/30"
                >
                  <div className="mb-2 text-sm font-medium text-text">Low</div>
                  <div className="text-xs text-textMuted">2GB RAM • FPS+</div>
                </button>
                <button
                  type="button"
                  className="group rounded-xl border border-white/5 bg-white/[0.02] p-4 text-left transition-all hover:border-brand-accent/30"
                >
                  <div className="mb-2 text-sm font-medium text-text">Medium</div>
                  <div className="text-xs text-textMuted">4GB RAM • Balanced</div>
                </button>
                <button
                  type="button"
                  className="group rounded-xl border border-white/5 bg-white/[0.02] p-4 text-left transition-all hover:border-brand-accent/30"
                >
                  <div className="mb-2 text-sm font-medium text-text">High</div>
                  <div className="text-xs text-textMuted">8GB RAM • Max FPS</div>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          <Card className="glass-card overflow-hidden rounded-2xl border border-white/5">
            <CardHeader className="border-b border-white/5 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle>{t(lang, "presets")}</CardTitle>
                <Badge variant="accent">{data.presets.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 pt-4">
              <select
                className="field bg-white/[0.02]"
                value={selectedPreset?.id ?? ""}
                onChange={(e) => setSelectedPresetId(e.target.value)}
              >
                {data.presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
              {selectedPreset ? (
                <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 text-sm">
                  <div className="font-semibold text-text">{selectedPreset.name}</div>
                  <div className="text-textMuted">{selectedPreset.description}</div>
                </div>
              ) : null}
              <textarea
                className="field-mono min-h-[200px] bg-white/[0.02]"
                value={presetJson}
                onChange={(e) => {
                  setPresetJson(e.target.value);
                  setPresetMsg(null);
                  setPresetErr(null);
                }}
              />
              {presetValidation.parseError ? (
                <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  Parse error: {presetValidation.parseError}
                </div>
              ) : null}
              {presetValidation.errors.length > 0 ? (
                <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-red-400">
                  <ul className="grid gap-1 text-xs">
                    {presetValidation.errors.map((e) => (
                      <li key={e}>• {e}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {presetMsg ? (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
                  {presetMsg}
                </div>
              ) : null}
              {presetErr ? (
                <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {presetErr}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => void savePreset()}
                  disabled={
                    !selectedPreset ||
                    !!presetValidation.parseError ||
                    presetValidation.errors.length > 0
                  }
                >
                  {t(lang, "savePresetPatch")}
                </Button>
                <Button
                  variant="outline"
                  disabled={!selectedPreset}
                  onClick={() => {
                    if (!selectedPreset) return;
                    const raw = exportPresetJson(selectedPreset.id);
                    if (!raw) return;
                    downloadJson(`${selectedPreset.name}-preset.json`, JSON.parse(raw));
                  }}
                >
                  {t(lang, "export")}
                </Button>
                <input
                  type="file"
                  accept=".json,application/json"
                  className="field file:mr-2 file:rounded-md file:border-0 file:bg-surface3 file:px-2 file:py-1 file:text-xs"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void importPreset(file);
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card overflow-hidden rounded-2xl border border-white/5">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle>Interface</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 pt-4">
              <label className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div>
                  <div className="font-medium">{t(lang, "language")}</div>
                  <div className="text-xs text-textMuted">English / Deutsch</div>
                </div>
                <select
                  className="field w-36 bg-white/[0.02]"
                  value={data.ui.language}
                  onChange={(e) => void setLanguage(e.target.value as "en" | "de")}
                >
                  <option value="en">{t(lang, "english")}</option>
                  <option value="de">{t(lang, "german")}</option>
                </select>
              </label>
            </CardContent>
          </Card>

          <Card className="glass-card overflow-hidden rounded-2xl border border-white/5">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle>Settings Snapshot History</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 pt-4">
              {data.settingsSnapshots.length === 0 ? (
                <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 text-sm text-textMuted">
                  No settings snapshots yet.
                </div>
              ) : null}
              {data.settingsSnapshots.slice(0, 8).map((snap) => (
                <div key={snap.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">
                        {snap.scope === "preset" ? `Preset ${snap.presetId}` : snap.scope}
                      </div>
                      <div className="text-xs text-textMuted">
                        {snap.note} • {formatDateTime(snap.createdAt, lang)}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void rollbackSettingsSnapshot(snap.id)}
                    >
                      {t(lang, "rollback")}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
