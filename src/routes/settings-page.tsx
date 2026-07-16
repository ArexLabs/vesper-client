import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { argsToMultiline, multilineToArgs } from "@/lib/config";
import { useT } from "@/lib/i18n";
import { type LauncherConfig, formatZodIssues, launcherConfigPatchSchema } from "@/lib/schemas";
import { downloadJson, formatDateTime, readTextFile } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useLauncherStore } from "@/store/launcher-store";
import {
  Cpu,
  Download,
  FileJson,
  HardDrive,
  Languages,
  Layers,
  Monitor,
  RotateCcw,
  Settings2,
  Upload,
  User,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function SettingsPage() {
  const data = useLauncherStore((s) => s.data);
  const { t, i18n } = useT();
  const updateGlobalDefaults = useLauncherStore((s) => s.updateGlobalDefaults);
  const savePresetPatch = useLauncherStore((s) => s.savePresetPatch);
  const rollbackSettingsSnapshot = useLauncherStore((s) => s.rollbackSettingsSnapshot);
  const setLanguage = useLauncherStore((s) => s.setLanguage);
  const exportPresetJson = useLauncherStore((s) => s.exportPresetJson);
  const importPresetJson = useLauncherStore((s) => s.importPresetJson);

  // --- Global Defaults State ---
  const [globalDraft, setGlobalDraft] = useState<LauncherConfig>(data.globalDefaults);
  const [globalMsg, setGlobalMsg] = useState<string | null>(null);
  const [globalErr, setGlobalErr] = useState<string | null>(null);

  const globalDefaults = data.globalDefaults;
  useEffect(() => {
    setGlobalDraft(globalDefaults);
  }, [globalDefaults]);

  async function saveGlobal() {
    const result = await updateGlobalDefaults(globalDraft);
    if (result.ok) {
      setGlobalMsg("Global defaults saved. Settings snapshot created.");
      setGlobalErr(null);
      setTimeout(() => setGlobalMsg(null), 3000);
    } else {
      setGlobalErr(result.issues?.join(" | ") ?? result.error);
      setGlobalMsg(null);
    }
  }

  // --- Presets State ---
  const [selectedPresetId, setSelectedPresetId] = useState<string>(data.presets[0]?.id ?? "");
  const selectedPreset =
    data.presets.find((p) => p.id === selectedPresetId) ?? data.presets[0] ?? null;
  const [presetJson, setPresetJson] = useState("{}");
  const [presetMsg, setPresetMsg] = useState<string | null>(null);
  const [presetErr, setPresetErr] = useState<string | null>(null);

  const configPatch = selectedPreset?.configPatch;
  useEffect(() => {
    if (!selectedPreset) return;
    setPresetJson(JSON.stringify(configPatch, null, 2));
    setPresetMsg(null);
    setPresetErr(null);
  }, [selectedPreset, configPatch]);

  const presetValidation = useMemo(() => {
    try {
      const parsed = JSON.parse(presetJson);
      const checked = launcherConfigPatchSchema.safeParse(parsed);
      if (!checked.success)
        return {
          parsed: null,
          parseError: null,
          errors: formatZodIssues(checked.error.issues),
        };
      return { parsed: checked.data, parseError: null, errors: [] as string[] };
    } catch (error) {
      return {
        parsed: null,
        parseError: error instanceof Error ? error.message : "Invalid JSON",
        errors: [] as string[],
      };
    }
  }, [presetJson]);

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
      setTimeout(() => setPresetMsg(null), 3000);
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

  // --- Account State ---
  const profiles = useLauncherStore((s) => s.data.profiles);
  const microsoftProfile = profiles.find((p) => p.provider === "microsoft");
  const isLoggedIn = microsoftProfile?.authState === "signed_in";
  const authRuntimeMessage = useLauncherStore((s) => s.authRuntimeMessage);
  const beginMicrosoftLogin = useLauncherStore((s) => s.beginMicrosoftLogin);
  const pollMicrosoftLogin = useLauncherStore((s) => s.pollMicrosoftLogin);
  const cancelMicrosoftLogin = useLauncherStore((s) => s.cancelMicrosoftLogin);
  const logoutMicrosoft = useLauncherStore((s) => s.logoutMicrosoft);

  const [flow, setFlow] = useState<{
    sessionId: string;
    userCode: string;
    verificationUriComplete: string | null;
    expiresAtMs: number;
    intervalMs: number;
  } | null>(null);

  const pollingRef = useRef(false);

  useEffect(() => {
    if (!flow) return;
    if (Date.now() >= flow.expiresAtMs) {
      setFlow(null);
      return;
    }
    const timer = window.setTimeout(async () => {
      if (pollingRef.current) return;
      pollingRef.current = true;
      try {
        const result = await pollMicrosoftLogin(flow.sessionId);
        if (result.status === "complete") {
          setFlow(null);
        } else if (result.status === "error") {
          setFlow(null);
        }
      } catch {
        setFlow(null);
      } finally {
        pollingRef.current = false;
      }
    }, flow.intervalMs);
    return () => window.clearTimeout(timer);
  }, [flow, pollMicrosoftLogin]);

  const startLogin = useCallback(async () => {
    try {
      const start = await beginMicrosoftLogin();
      setFlow({
        sessionId: start.sessionId,
        userCode: start.userCode,
        verificationUriComplete: start.verificationUriComplete ?? start.verificationUri,
        expiresAtMs: Date.now() + start.expiresInSeconds * 1000,
        intervalMs: Math.max(1000, start.intervalSeconds * 1000),
      });
    } catch {
      // handled by store
    }
  }, [beginMicrosoftLogin]);

  const cancelFlow = useCallback(async () => {
    if (!flow) return;
    await cancelMicrosoftLogin(flow.sessionId);
    setFlow(null);
  }, [flow, cancelMicrosoftLogin]);

  return (
    <div className="flex flex-col gap-6 motion-preset-fade motion-duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-white">{t("settings")}</h1>
        <p className="text-sm text-textMuted">
          Configure your launcher, java, presets and account.
        </p>
      </div>

      <Tabs defaultValue="account" className="w-full">
        <div className="w-full overflow-x-auto pb-2 scrollbar-none">
          <TabsList className="mb-4 inline-flex h-12 w-max min-w-full items-center justify-start gap-2 rounded-2xl bg-surface2/50 p-1">
            <TabsTrigger
              value="account"
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
            >
              <User className="h-4 w-4" />
              {t("account")}
            </TabsTrigger>
            <TabsTrigger
              value="java"
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
            >
              <Cpu className="h-4 w-4" />
              Java
            </TabsTrigger>
            <TabsTrigger
              value="presets"
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
            >
              <Layers className="h-4 w-4" />
              Presets
            </TabsTrigger>
            <TabsTrigger
              value="launcher"
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
            >
              <Settings2 className="h-4 w-4" />
              Launcher
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
            >
              <RotateCcw className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>
        </div>

        {/* --- Account Tab --- */}
        <TabsContent value="account" className="mt-0 outline-none">
          <div className="grid gap-6">
            <Card className="border-border/50 bg-surface1/50 shadow-lift">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>Microsoft Account</CardTitle>
                    <CardDescription>Manage your authentication and profile.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {isLoggedIn ? (
                  <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-lg font-bold text-primary shadow-glow-sm">
                        {(microsoftProfile?.displayName ?? "?")[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-white">
                          {microsoftProfile?.displayName}
                        </p>
                        <p className="text-xs text-textMuted uppercase tracking-wider">
                          Connected via Microsoft
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => void logoutMicrosoft()}
                      className="rounded-xl border-danger/20 hover:bg-danger/10 hover:text-danger"
                    >
                      Sign Out
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-surface2 text-textMuted">
                      <User className="h-8 w-8" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-white">Not Signed In</h3>
                    <p className="mb-6 max-w-xs text-sm text-textMuted">
                      Sign in with your Microsoft account to sync profiles and play Minecraft.
                    </p>
                    <Button
                      onClick={() => void startLogin()}
                      disabled={!!flow}
                      className="rounded-xl px-8 py-5 text-base font-bold shadow-glow"
                    >
                      {flow ? "Waiting for login..." : "Connect Microsoft Account"}
                    </Button>
                  </div>
                )}

                {flow && (
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-widest text-primary">
                          Microsoft Activation
                        </span>
                        <Badge
                          variant="outline"
                          className="rounded-lg border-primary/30 text-primary"
                        >
                          PENDING
                        </Badge>
                      </div>
                      <p className="text-sm leading-relaxed text-text">
                        Please visit{" "}
                        <a
                          href={flow.verificationUriComplete ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-primary underline underline-offset-4"
                        >
                          microsoft.com/link
                        </a>{" "}
                        and enter the activation code below to complete the sign-in process.
                      </p>
                      <div className="my-2 rounded-2xl border border-primary/30 bg-surface1 px-6 py-4 shadow-inner">
                        <div className="mb-1 text-[10px] uppercase tracking-widest text-textMuted text-center">
                          Code
                        </div>
                        <div className="font-mono text-3xl font-bold tracking-[0.2em] text-white text-center select-all">
                          {flow.userCode}
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          className="flex-1 rounded-xl"
                          onClick={() => navigator.clipboard.writeText(flow.userCode)}
                        >
                          Copy Code
                        </Button>
                        <Button
                          variant="ghost"
                          className="flex-1 rounded-xl text-textMuted hover:bg-danger/10 hover:text-danger"
                          onClick={cancelFlow}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {authRuntimeMessage && (
                  <div className="rounded-xl border border-border bg-surface2/50 px-4 py-3 text-xs text-textMuted">
                    <span className="mr-2 font-bold text-primary">NOTE:</span>
                    {authRuntimeMessage}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* --- Java Tab --- */}
        <TabsContent value="java" className="mt-0 outline-none">
          <div className="grid gap-6">
            <Card className="border-border/50 bg-surface1/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-500/10 text-amber-500">
                    <HardDrive className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>Global Defaults</CardTitle>
                    <CardDescription>
                      Base configurations applied to all instances unless overridden.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-8">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-textMuted">
                      Java Path
                    </Label>
                    <Input
                      className="rounded-xl border-border bg-surface2 focus:border-primary/50"
                      value={globalDraft.javaPath}
                      onChange={(e) =>
                        setGlobalDraft({
                          ...globalDraft,
                          javaPath: e.target.value,
                        })
                      }
                      placeholder="/usr/bin/java"
                    />
                    <p className="text-[11px] text-textMuted">
                      Path to your Java executable. Leave empty to use system default.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-widest text-textMuted">
                        Min Memory (MB)
                      </Label>
                      <Input
                        type="number"
                        className="rounded-xl border-border bg-surface2 focus:border-primary/50"
                        value={globalDraft.memoryMbMin}
                        onChange={(e) =>
                          setGlobalDraft({
                            ...globalDraft,
                            memoryMbMin: Number(e.target.value || 0),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-widest text-textMuted">
                        Max Memory (MB)
                      </Label>
                      <Input
                        type="number"
                        className="rounded-xl border-border bg-surface2 focus:border-primary/50"
                        value={globalDraft.memoryMbMax}
                        onChange={(e) =>
                          setGlobalDraft({
                            ...globalDraft,
                            memoryMbMax: Number(e.target.value || 0),
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold uppercase tracking-widest text-textMuted">
                        Window Resolution
                      </Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="fullscreen-check"
                          className="h-4 w-4 rounded border-border bg-surface3 text-primary focus:ring-primary/50"
                          checked={globalDraft.window.fullscreen}
                          onChange={(e) =>
                            setGlobalDraft({
                              ...globalDraft,
                              window: {
                                ...globalDraft.window,
                                fullscreen: e.target.checked,
                              },
                            })
                          }
                        />
                        <Label
                          htmlFor="fullscreen-check"
                          className="text-xs text-textMuted cursor-pointer hover:text-white transition-colors"
                        >
                          Fullscreen
                        </Label>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Input
                        type="number"
                        className="rounded-xl border-border bg-surface2 focus:border-primary/50"
                        value={globalDraft.window.width}
                        placeholder="Width"
                        onChange={(e) =>
                          setGlobalDraft({
                            ...globalDraft,
                            window: {
                              ...globalDraft.window,
                              width: Number(e.target.value || 0),
                            },
                          })
                        }
                      />
                      <div className="grid place-items-center text-textMuted">×</div>
                      <Input
                        type="number"
                        className="rounded-xl border-border bg-surface2 focus:border-primary/50"
                        value={globalDraft.window.height}
                        placeholder="Height"
                        onChange={(e) =>
                          setGlobalDraft({
                            ...globalDraft,
                            window: {
                              ...globalDraft.window,
                              height: Number(e.target.value || 0),
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-textMuted">
                      JVM Arguments
                    </Label>
                    <Textarea
                      className="min-h-[140px] resize-none rounded-2xl border-border bg-surface2 font-mono text-[13px] leading-relaxed focus:border-primary/50"
                      value={argsToMultiline(globalDraft.jvmArgs)}
                      onChange={(e) =>
                        setGlobalDraft({
                          ...globalDraft,
                          jvmArgs: multilineToArgs(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-textMuted">
                      Renderer Flags
                    </Label>
                    <Textarea
                      className="min-h-[140px] resize-none rounded-2xl border-border bg-surface2 font-mono text-[13px] leading-relaxed focus:border-primary/50"
                      value={argsToMultiline(globalDraft.rendererFlags)}
                      onChange={(e) =>
                        setGlobalDraft({
                          ...globalDraft,
                          rendererFlags: multilineToArgs(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-textMuted">
                      Launch Arguments
                    </Label>
                    <Textarea
                      className="min-h-[140px] resize-none rounded-2xl border-border bg-surface2 font-mono text-[13px] leading-relaxed focus:border-primary/50"
                      value={argsToMultiline(globalDraft.launchArgs)}
                      onChange={(e) =>
                        setGlobalDraft({
                          ...globalDraft,
                          launchArgs: multilineToArgs(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>

                {globalMsg && (
                  <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success animate-in fade-in zoom-in-95">
                    {globalMsg}
                  </div>
                )}
                {globalErr && (
                  <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger animate-in fade-in zoom-in-95">
                    {globalErr}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={() => void saveGlobal()}
                    className="rounded-xl px-6 py-5 font-bold shadow-glow-sm"
                  >
                    {t("saveGlobalDefaults")}
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() =>
                      downloadJson("vesper-global-defaults.json", {
                        schema: "vesper/global-defaults/v1",
                        globalDefaults: globalDraft,
                      })
                    }
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {t("export")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* --- Presets Tab --- */}
        <TabsContent value="presets" className="mt-0 outline-none">
          <div className="grid gap-6">
            <Card className="border-border/50 bg-surface1/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-indigo-500/10 text-indigo-500">
                      <Layers className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle>Presets & Patches</CardTitle>
                      <CardDescription>
                        Technical overrides and shared configuration profiles.
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="rounded-lg h-7 px-3">
                    {data.presets.length} Presets
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <Label className="text-xs font-bold uppercase tracking-widest text-textMuted">
                        Select Preset
                      </Label>
                      <Select
                        value={selectedPreset?.id ?? ""}
                        onValueChange={(val) => setSelectedPresetId(val ?? "")}
                      >
                        <SelectTrigger className="h-12 rounded-2xl border-border bg-surface2">
                          <SelectValue placeholder="Choose a preset..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-border bg-surface2">
                          {data.presets.map((preset) => (
                            <SelectItem key={preset.id} value={preset.id} className="rounded-xl">
                              {preset.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedPreset && (
                      <div className="rounded-2xl border border-border bg-surface2/30 p-5">
                        <h4 className="text-sm font-bold text-white">{selectedPreset.name}</h4>
                        <p className="mt-1 text-xs leading-relaxed text-textMuted">
                          {selectedPreset.description}
                        </p>
                        <div className="mt-4 flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-textMuted/50">
                          <RotateCcw className="h-3 w-3" />
                          Last updated {formatDateTime(selectedPreset.updatedAt, i18n.language)}
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      <Label className="text-xs font-bold uppercase tracking-widest text-textMuted">
                        Import New Preset
                      </Label>
                      <div className="flex items-center justify-center rounded-2xl border-2 border-dashed border-border p-8 transition-colors hover:border-primary/30">
                        <label className="flex cursor-pointer flex-col items-center gap-2">
                          <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface2 text-primary">
                            <Upload className="h-5 w-5" />
                          </div>
                          <span className="text-sm font-medium text-text">
                            Drop or click to import .json
                          </span>
                          <input
                            type="file"
                            accept=".json,application/json"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) void importPreset(file);
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-xs font-bold uppercase tracking-widest text-textMuted">
                      Config Patch (JSON)
                    </Label>
                    <Textarea
                      className="min-h-[380px] resize-none rounded-2xl border-border bg-surface2 font-mono text-[12px] leading-relaxed focus:border-primary/50"
                      value={presetJson}
                      onChange={(e) => {
                        setPresetJson(e.target.value);
                        setPresetMsg(null);
                        setPresetErr(null);
                      }}
                    />
                  </div>
                </div>

                {presetValidation.parseError && (
                  <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger flex items-center gap-3">
                    <span className="font-bold">JSON Error:</span>
                    {presetValidation.parseError}
                  </div>
                )}

                {presetValidation.errors.length > 0 && (
                  <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-danger">
                    <div className="mb-2 text-xs font-bold uppercase tracking-widest">
                      Validation Errors
                    </div>
                    <ul className="grid gap-1.5 text-xs">
                      {presetValidation.errors.map((e) => (
                        <li key={e} className="flex gap-2">
                          <span className="text-danger/50">•</span>
                          {e}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(presetMsg || presetErr) && (
                  <div
                    className={cn(
                      "rounded-xl border px-4 py-3 text-sm animate-in fade-in zoom-in-95",
                      presetMsg
                        ? "border-success/30 bg-success/10 text-success"
                        : "border-danger/30 bg-danger/10 text-danger",
                    )}
                  >
                    {presetMsg || presetErr}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={() => void savePreset()}
                    className="rounded-xl px-6"
                    disabled={
                      !selectedPreset ||
                      !!presetValidation.parseError ||
                      presetValidation.errors.length > 0
                    }
                  >
                    Save Changes
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl px-6"
                    disabled={!selectedPreset}
                    onClick={() => {
                      if (!selectedPreset) return;
                      const raw = exportPresetJson(selectedPreset.id);
                      if (!raw) return;
                      downloadJson(`${selectedPreset.name}-preset.json`, JSON.parse(raw));
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export JSON
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* --- Launcher Tab --- */}
        <TabsContent value="launcher" className="mt-0 outline-none">
          <div className="grid gap-6">
            <Card className="border-border/50 bg-surface1/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-500/10 text-cyan-500">
                    <Monitor className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>Interface & Localization</CardTitle>
                    <CardDescription>Personalize your launcher experience.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-6">
                <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-border bg-surface2/50 p-6 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-4">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface2 text-textMuted">
                      <Languages className="h-5 w-5" />
                    </div>
                    <div>
                      <Label className="text-base font-semibold text-white">{t("language")}</Label>
                      <p className="text-xs text-textMuted">Choose your preferred UI language.</p>
                    </div>
                  </div>
                  <Select
                    value={data.ui.language}
                    onValueChange={(val) => void setLanguage(val as "en" | "de")}
                  >
                    <SelectTrigger className="w-full h-10 rounded-xl border-border bg-surface1 sm:w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border bg-surface2">
                      <SelectItem value="en" className="rounded-lg">
                        {t("english")}
                      </SelectItem>
                      <SelectItem value="de" className="rounded-lg">
                        {t("german")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-border bg-surface2/50 p-6 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-4">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface2 text-textMuted">
                      <Monitor className="h-5 w-5" />
                    </div>
                    <div>
                      <Label className="text-base font-semibold text-white">Animations</Label>
                      <p className="text-xs text-textMuted">Toggle UI transitions and effects.</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-md border-success/30 text-success">
                    ENABLED
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* --- History Tab --- */}
        <TabsContent value="history" className="mt-0 outline-none">
          <div className="grid gap-6">
            <Card className="border-border/50 bg-surface1/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-500">
                    <RotateCcw className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>Settings History</CardTitle>
                    <CardDescription>
                      Rollback snapshots for global defaults and presets.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4">
                {data.settingsSnapshots.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <RotateCcw className="h-10 w-10 text-textMuted opacity-20" />
                    <p className="mt-4 text-sm text-textMuted">No snapshots found yet.</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {data.settingsSnapshots.slice(0, 15).map((snap) => (
                      <div
                        key={snap.id}
                        className="group overflow-hidden rounded-2xl border border-border bg-surface2/30 transition-all hover:border-primary/30 hover:bg-surface2/50"
                      >
                        <div className="flex items-center justify-between gap-4 px-5 py-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md",
                                  snap.scope === "globalDefaults"
                                    ? "bg-amber-500/10 text-amber-500"
                                    : snap.scope === "preset"
                                      ? "bg-indigo-500/10 text-indigo-500"
                                      : "bg-cyan-500/10 text-cyan-500",
                                )}
                              >
                                {snap.scope}
                              </span>
                              <span className="text-xs font-semibold text-white truncate max-w-[200px]">
                                {snap.note}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] text-textMuted">
                              {formatDateTime(snap.createdAt, i18n.language)}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => void rollbackSettingsSnapshot(snap.id)}
                          >
                            Rollback
                          </Button>
                        </div>
                        <div className="border-t border-border/50 bg-black/20 px-5 py-3">
                          <div className="flex items-center justify-between text-[10px] font-bold text-textMuted uppercase tracking-widest">
                            <span>Changes Preview</span>
                            <FileJson className="h-3 w-3" />
                          </div>
                          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-textMuted leading-relaxed scrollbar-thin">
                            {JSON.stringify(
                              {
                                globalDefaults: snap.globalDefaults,
                                presetPatch: snap.presetPatch,
                                uiLanguage: snap.uiLanguage,
                              },
                              null,
                              2,
                            ).substring(0, 500)}
                            ...
                          </pre>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
