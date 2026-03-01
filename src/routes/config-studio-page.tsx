import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveInstanceConfig } from "@/lib/config";
import { t } from "@/lib/i18n";
import { formatZodIssues, launcherConfigSchema } from "@/lib/schemas";
import { downloadJson, readTextFile } from "@/lib/utils";
import { useLauncherStore } from "@/store/launcher-store";
import { Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

export function ConfigStudioPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const data = useLauncherStore((s) => s.data);
  const lang = data.ui.language;
  const saveInstanceResolvedConfig = useLauncherStore((s) => s.saveInstanceResolvedConfig);
  const exportInstanceResolvedConfigJson = useLauncherStore(
    (s) => s.exportInstanceResolvedConfigJson,
  );
  const importInstanceResolvedConfigJson = useLauncherStore(
    (s) => s.importInstanceResolvedConfigJson,
  );

  const instances = data.instances;
  const selectedId = searchParams.get("instance");
  const selectedInstance = instances.find((i) => i.id === selectedId) ?? instances[0] ?? null;
  const resolved = selectedInstance ? resolveInstanceConfig(data, selectedInstance) : null;

  const [draftJson, setDraftJson] = useState("");
  const [snapshotNote, setSnapshotNote] = useState("Config Studio save");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedInstance || !resolved) return;
    setDraftJson(JSON.stringify(resolved, null, 2));
    setMsg(null);
    setErr(null);
  }, [selectedInstance?.id, JSON.stringify(resolved)]);

  const validation = useMemo(() => {
    if (!draftJson.trim())
      return { parseError: "JSON is empty", zodErrors: [] as string[], parsed: null };
    try {
      const parsed = JSON.parse(draftJson);
      const checked = launcherConfigSchema.safeParse(parsed);
      if (!checked.success) {
        return { parseError: null, zodErrors: formatZodIssues(checked.error.issues), parsed: null };
      }
      return { parseError: null, zodErrors: [] as string[], parsed: checked.data };
    } catch (error) {
      return {
        parseError: error instanceof Error ? error.message : "Invalid JSON",
        zodErrors: [] as string[],
        parsed: null,
      };
    }
  }, [draftJson]);

  async function onSave() {
    if (!selectedInstance) return;
    const result = await saveInstanceResolvedConfig(
      selectedInstance.id,
      validation.parsed,
      snapshotNote,
    );
    if (result.ok) {
      setMsg("Saved successfully. Snapshot created.");
      setErr(null);
    } else {
      setErr(result.issues?.join(" | ") ?? result.error);
      setMsg(null);
    }
  }

  async function onImport(file: File) {
    if (!selectedInstance) return;
    const text = await readTextFile(file);
    setDraftJson(text);
    const result = await importInstanceResolvedConfigJson(selectedInstance.id, text);
    if (result.ok) {
      setMsg("Imported and saved. Snapshot created.");
      setErr(null);
    } else {
      setErr(result.issues?.join(" | ") ?? result.error);
      setMsg(null);
    }
  }

  if (!selectedInstance) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t(lang, "configStudio")}</CardTitle>
          <CardDescription>No instances available yet.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/instances">{t(lang, "createInstance")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const hasErrors = !!validation.parseError || validation.zodErrors.length > 0;

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{t(lang, "configStudio")}</CardTitle>
              <CardDescription>
                Safe JSON editor with inline validation and snapshot writes.
              </CardDescription>
            </div>
            <Badge variant="accent">Config-First</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[1fr_220px_220px_auto]">
          <select
            className="field"
            value={selectedInstance.id}
            onChange={(e) => setSearchParams({ instance: e.target.value })}
          >
            {instances.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.mcVersion} • {i.loader})
              </option>
            ))}
          </select>
          <input
            className="field"
            value={snapshotNote}
            onChange={(e) => setSnapshotNote(e.target.value)}
            placeholder="Snapshot note"
          />
          <input
            type="file"
            accept=".json,application/json"
            className="field file:mr-2 file:rounded-md file:border-0 file:bg-surface3 file:px-2 file:py-1 file:text-xs"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImport(f);
            }}
          />
          <div className="flex gap-2">
            <Button onClick={() => void onSave()} disabled={!validation.parsed || hasErrors}>
              <Save className="h-4 w-4" />
              {t(lang, "saveSnapshot")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const json = exportInstanceResolvedConfigJson(selectedInstance.id);
                if (!json) return;
                downloadJson(`${selectedInstance.name}-config.json`, JSON.parse(json));
              }}
            >
              {t(lang, "export")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <CardTitle>JSON Editor</CardTitle>
            <CardDescription>
              Edit resolved config; save persists diff-only overrides.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <textarea
              className="field-mono min-h-[560px] w-full"
              value={draftJson}
              onChange={(e) => {
                setDraftJson(e.target.value);
                setMsg(null);
                setErr(null);
              }}
              spellCheck={false}
            />
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t(lang, "validation")}</CardTitle>
              <CardDescription>Zod-backed inline validation</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {validation.parseError ? (
                <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-danger">
                  Parse error: {validation.parseError}
                </div>
              ) : null}
              {validation.zodErrors.length > 0 ? (
                <div className="rounded-md border border-danger/30 bg-danger/10 p-3">
                  <div className="mb-2 text-xs font-semibold text-danger">Schema errors</div>
                  <ul className="grid gap-1 text-xs text-danger">
                    {validation.zodErrors.map((e) => (
                      <li key={e}>• {e}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {!hasErrors ? (
                <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-success">
                  Valid config JSON. Ready to save.
                </div>
              ) : null}
              {msg ? (
                <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-success">
                  {msg}
                </div>
              ) : null}
              {err ? (
                <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-danger">
                  {err}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t(lang, "workflowSafety")}</CardTitle>
              <CardDescription>Snapshot-safe editing flow</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm text-textMuted">
              <div>1. JSON parse</div>
              <div>2. Zod validate</div>
              <div>3. Diff vs Global + Preset</div>
              <div>4. Persist overrides (diff-only)</div>
              <div>5. Create snapshot</div>
              <Button asChild size="sm" variant="outline" className="mt-2">
                <Link to={`/instances/${selectedInstance.id}`}>{t(lang, "history")}</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t(lang, "sourceChain")}</CardTitle>
              <CardDescription>Effective config composition</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="panel-soft p-3 text-sm">
                <div>Global Defaults</div>
                <div className="text-textMuted">
                  + Preset Patch ({selectedInstance.presetId ?? "None"})
                </div>
                <div className="text-textMuted">+ Instance Overrides (diff)</div>
                <div className="mt-2 font-semibold">= Resolved Config</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
