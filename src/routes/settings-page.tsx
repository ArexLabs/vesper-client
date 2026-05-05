import { useEffect, useMemo, useState } from "react";
import { argsToMultiline, multilineToArgs } from "@/lib/config";
import { t } from "@/lib/i18n";
import { formatZodIssues, launcherConfigPatchSchema, type LauncherConfig } from "@/lib/schemas";
import { downloadJson, formatDateTime, readTextFile } from "@/lib/utils";
import { useLauncherStore } from "@/store/launcher-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
    <div className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t(lang, "globalDefaults")}</CardTitle>
            <CardDescription>
              Java, Memory, JVM Args, Renderer Flags, Window and Launch Args.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label">Java Path</label>
                <input
                  className="field mt-1"
                  value={globalDraft.javaPath}
                  onChange={(e) => setGlobalDraft({ ...globalDraft, javaPath: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Min MB</label>
                  <input
                    type="number"
                    className="field mt-1"
                    value={globalDraft.memoryMbMin}
                    onChange={(e) =>
                      setGlobalDraft({ ...globalDraft, memoryMbMin: Number(e.target.value || 0) })
                    }
                  />
                </div>
                <div>
                  <label className="label">Max MB</label>
                  <input
                    type="number"
                    className="field mt-1"
                    value={globalDraft.memoryMbMax}
                    onChange={(e) =>
                      setGlobalDraft({ ...globalDraft, memoryMbMax: Number(e.target.value || 0) })
                    }
                  />
                </div>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="label">Window Width</label>
                <input
                  type="number"
                  className="field mt-1"
                  value={globalDraft.window.width}
                  onChange={(e) =>
                    setGlobalDraft({
                      ...globalDraft,
                      window: { ...globalDraft.window, width: Number(e.target.value || 0) },
                    })
                  }
                />
              </div>
              <div>
                <label className="label">Window Height</label>
                <input
                  type="number"
                  className="field mt-1"
                  value={globalDraft.window.height}
                  onChange={(e) =>
                    setGlobalDraft({
                      ...globalDraft,
                      window: { ...globalDraft.window, height: Number(e.target.value || 0) },
                    })
                  }
                />
              </div>
              <label className="mt-6 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={globalDraft.window.fullscreen}
                  onChange={(e) =>
                    setGlobalDraft({
                      ...globalDraft,
                      window: { ...globalDraft.window, fullscreen: e.target.checked },
                    })
                  }
                />
                Fullscreen
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="label">JVM Args</label>
                <textarea
                  className="field-mono mt-1 min-h-[130px]"
                  value={argsToMultiline(globalDraft.jvmArgs)}
                  onChange={(e) =>
                    setGlobalDraft({ ...globalDraft, jvmArgs: multilineToArgs(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="label">Renderer Flags</label>
                <textarea
                  className="field-mono mt-1 min-h-[130px]"
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
                <label className="label">Launch Args</label>
                <textarea
                  className="field-mono mt-1 min-h-[130px]"
                  value={argsToMultiline(globalDraft.launchArgs)}
                  onChange={(e) =>
                    setGlobalDraft({ ...globalDraft, launchArgs: multilineToArgs(e.target.value) })
                  }
                />
              </div>
            </div>
            {globalMsg ? (
              <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                {globalMsg}
              </div>
            ) : null}
            {globalErr ? (
              <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                {globalErr}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void saveGlobal()}>{t(lang, "saveGlobalDefaults")}</Button>
              <Button
                variant="outline"
                onClick={() =>
                  downloadJson("vesper-global-defaults.json", {
                    schema: "vesper/global-defaults/v1",
                    globalDefaults: globalDraft,
                  })
                }
              >
                {t(lang, "export")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>{t(lang, "presets")}</CardTitle>
                  <CardDescription>Apply/edit/export/import preset patches.</CardDescription>
                </div>
                <Badge variant="accent">{data.presets.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              <select
                className="field"
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
                <div className="panel-soft p-3 text-sm">
                  <div className="font-semibold">{selectedPreset.name}</div>
                  <div className="text-textMuted">{selectedPreset.description}</div>
                </div>
              ) : null}
              <textarea
                className="field-mono min-h-[220px]"
                value={presetJson}
                onChange={(e) => {
                  setPresetJson(e.target.value);
                  setPresetMsg(null);
                  setPresetErr(null);
                }}
              />
              {presetValidation.parseError ? (
                <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  Parse error: {presetValidation.parseError}
                </div>
              ) : null}
              {presetValidation.errors.length > 0 ? (
                <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-danger">
                  <ul className="grid gap-1 text-xs">
                    {presetValidation.errors.map((e) => (
                      <li key={e}>• {e}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {presetMsg ? (
                <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                  {presetMsg}
                </div>
              ) : null}
              {presetErr ? (
                <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
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

          <Card>
            <CardHeader>
              <CardTitle>Interface</CardTitle>
              <CardDescription>Client display preferences.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <label className="flex items-center justify-between gap-4 rounded-md border border-borderSoft bg-surface1 p-3">
                <div>
                  <div className="font-semibold">{t(lang, "language")}</div>
                  <div className="text-textMuted">English / Deutsch</div>
                </div>
                <select
                  className="field w-36"
                  value={data.ui.language}
                  onChange={(e) => void setLanguage(e.target.value as "en" | "de")}
                >
                  <option value="en">{t(lang, "english")}</option>
                  <option value="de">{t(lang, "german")}</option>
                </select>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Settings Snapshot History</CardTitle>
              <CardDescription>
                Rollback for global defaults, presets and UI language.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {data.settingsSnapshots.length === 0 ? (
                <div className="panel-soft p-3 text-sm text-textMuted">
                  No settings snapshots yet.
                </div>
              ) : null}
              {data.settingsSnapshots.slice(0, 12).map((snap) => (
                <div key={snap.id} className="panel-soft p-3">
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
                  <pre className="field-mono max-h-40 overflow-auto whitespace-pre-wrap">
                    {JSON.stringify(
                      {
                        globalDefaults: snap.globalDefaults,
                        presetPatch: snap.presetPatch,
                        uiLanguage: snap.uiLanguage,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
