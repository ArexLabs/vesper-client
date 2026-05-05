import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { t } from "@/lib/i18n";
import type { Instance } from "@/lib/schemas";
import { formatDateTime } from "@/lib/utils";
import { useLauncherStore } from "@/store/launcher-store";

type ViewMode = "cards" | "table";
type SortMode = "updated" | "name" | "version";

export function InstancesPage() {
  const lang = useLauncherStore((s) => s.data.ui.language);
  const instances = useLauncherStore((s) => s.data.instances);
  const presets = useLauncherStore((s) => s.data.presets);
  const createInstance = useLauncherStore((s) => s.createInstance);

  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [sortMode, setSortMode] = useState<SortMode>("updated");
  const [search, setSearch] = useState("");
  const [loaderFilter, setLoaderFilter] = useState<string>("all");

  const [newName, setNewName] = useState("");
  const [newVersion, setNewVersion] = useState("1.20.1");
  const [newLoader, setNewLoader] = useState<Instance["loader"]>("fabric");
  const [newModpackName, setNewModpackName] = useState("");

  const presetById = useMemo(
    () => Object.fromEntries(presets.map((p) => [p.id, p.name])),
    [presets],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = instances.filter((i) => {
      if (loaderFilter !== "all" && i.loader !== loaderFilter) return false;
      if (!q) return true;
      return [i.name, i.mcVersion, i.loader, i.modpackName ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
    list.sort((a, b) => {
      if (sortMode === "name") return a.name.localeCompare(b.name);
      if (sortMode === "version") return b.mcVersion.localeCompare(a.mcVersion);
      return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
    });
    return list;
  }, [instances, loaderFilter, search, sortMode]);

  async function onCreate() {
    if (!newName.trim() || !newVersion.trim()) return;
    await createInstance({
      name: newName,
      mcVersion: newVersion,
      loader: newLoader,
      modpackName: newModpackName || null,
    });
    setNewName("");
    setNewModpackName("");
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t(lang, "instanceLibrary")}</CardTitle>
          <CardDescription>Cards + Table toggle, sort, filter and search.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto_auto]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-textMuted" />
              <input
                className="field pl-9"
                placeholder={t(lang, "searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <select
              className="field"
              value={loaderFilter}
              onChange={(e) => setLoaderFilter(e.target.value)}
            >
              <option value="all">{t(lang, "allLoaders")}</option>
              <option value="vanilla">Vanilla</option>
              <option value="fabric">Fabric</option>
              <option value="forge">Forge</option>
              <option value="neoforge">NeoForge</option>
              <option value="quilt">Quilt</option>
            </select>
            <select
              className="field"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
            >
              <option value="updated">{t(lang, "sortUpdated")}</option>
              <option value="name">{t(lang, "sortName")}</option>
              <option value="version">{t(lang, "sortVersion")}</option>
            </select>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={viewMode === "cards" ? "default" : "outline"}
                onClick={() => setViewMode("cards")}
              >
                {t(lang, "cards")}
              </Button>
              <Button
                size="sm"
                variant={viewMode === "table" ? "default" : "outline"}
                onClick={() => setViewMode("table")}
              >
                {t(lang, "table")}
              </Button>
            </div>
            <div className="text-right text-xs text-textMuted">
              {rows.length}/{instances.length}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t(lang, "createInstance")}</CardTitle>
          <CardDescription>
            MVP creation flow with Tauri command seam and local fallback.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[1.2fr_0.7fr_0.7fr_1fr_auto]">
          <input
            className="field"
            placeholder={t(lang, "instanceName")}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            className="field"
            placeholder={t(lang, "mcVersion")}
            value={newVersion}
            onChange={(e) => setNewVersion(e.target.value)}
          />
          <select
            className="field"
            value={newLoader}
            onChange={(e) => setNewLoader(e.target.value as Instance["loader"])}
          >
            <option value="vanilla">Vanilla</option>
            <option value="fabric">Fabric</option>
            <option value="forge">Forge</option>
            <option value="neoforge">NeoForge</option>
            <option value="quilt">Quilt</option>
          </select>
          <input
            className="field"
            placeholder={t(lang, "modpackNameOptional")}
            value={newModpackName}
            onChange={(e) => setNewModpackName(e.target.value)}
          />
          <Button onClick={() => void onCreate()} disabled={!newName.trim() || !newVersion.trim()}>
            {t(lang, "create")}
          </Button>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-semibold">{t(lang, "noInstances")}</div>
            <div className="muted">{t(lang, "noInstancesHint")}</div>
          </CardContent>
        </Card>
      ) : null}

      {viewMode === "cards" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((instance) => (
            <Card key={instance.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{instance.name}</CardTitle>
                    <CardDescription>
                      {instance.mcVersion} • {instance.loader}
                    </CardDescription>
                  </div>
                  <Badge variant="accent">{instance.loader}</Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="grid gap-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-textMuted">{t(lang, "preset")}</span>
                    <span>
                      {instance.presetId
                        ? (presetById[instance.presetId] ?? instance.presetId)
                        : "None"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-textMuted">{t(lang, "snapshots")}</span>
                    <span>{instance.snapshots.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-textMuted">{t(lang, "lastPlayed")}</span>
                    <span>{formatDateTime(instance.lastPlayedAt, lang)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {instance.tags.map((tag) => (
                    <Badge key={tag} variant="muted">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button asChild className="flex-1">
                    <Link to={`/instances/${instance.id}`}>{t(lang, "open")}</Link>
                  </Button>
                  <Button asChild variant="outline" className="flex-1">
                    <Link to={`/config-studio?instance=${instance.id}`}>
                      {t(lang, "configStudio")}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-border bg-surface1">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Version</th>
                    <th className="px-4 py-3">Loader</th>
                    <th className="px-4 py-3">{t(lang, "preset")}</th>
                    <th className="px-4 py-3">{t(lang, "snapshots")}</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3 text-right">{t(lang, "open")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((instance) => (
                    <tr key={instance.id} className="border-b border-borderSoft/80">
                      <td className="px-4 py-3">
                        <div className="font-medium">{instance.name}</div>
                        <div className="text-xs text-textMuted">{instance.modpackName ?? "—"}</div>
                      </td>
                      <td className="px-4 py-3">{instance.mcVersion}</td>
                      <td className="px-4 py-3">
                        <Badge variant="muted">{instance.loader}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {instance.presetId
                          ? (presetById[instance.presetId] ?? instance.presetId)
                          : "None"}
                      </td>
                      <td className="px-4 py-3">{instance.snapshots.length}</td>
                      <td className="px-4 py-3">{formatDateTime(instance.updatedAt, lang)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/instances/${instance.id}`}>{t(lang, "open")}</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
