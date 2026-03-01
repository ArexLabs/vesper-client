import { LayoutGrid, List, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CreateInstanceSheet } from "@/components/instances/CreateInstanceSheet";
import { InstanceCard } from "@/components/instances/InstanceCard";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { t } from "@/lib/i18n";
import type { Instance } from "@/lib/schemas";
import { formatDateTime } from "@/lib/utils";
import { useLauncherStore } from "@/store/launcher-store";

type ViewMode = "cards" | "table";
type SortMode = "updated" | "name" | "version";

export function InstancesPage() {
  const lang = useLauncherStore((state) => state.data.ui.language);
  const instances = useLauncherStore((state) => state.data.instances);
  const presets = useLauncherStore((state) => state.data.presets);
  const createInstance = useLauncherStore((state) => state.createInstance);
  const launchInstance = useLauncherStore((state) => state.launchInstance);

  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [sortMode, setSortMode] = useState<SortMode>("updated");
  const [search, setSearch] = useState("");
  const [loaderFilter, setLoaderFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const presetById = useMemo(
    () => Object.fromEntries(presets.map((preset) => [preset.id, preset.name])),
    [presets],
  );

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = instances.filter((instance) => {
      if (loaderFilter !== "all" && instance.loader !== loaderFilter) return false;
      if (!query) return true;
      return [instance.name, instance.mcVersion, instance.loader, instance.modpackName ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });

    filtered.sort((left, right) => {
      if (sortMode === "name") return left.name.localeCompare(right.name);
      if (sortMode === "version") return right.mcVersion.localeCompare(left.mcVersion);
      return (right.updatedAt ?? "").localeCompare(left.updatedAt ?? "");
    });

    return filtered;
  }, [instances, loaderFilter, search, sortMode]);

  async function handleCreate(input: {
    name: string;
    mcVersion: string;
    loader: Instance["loader"];
    modpackName?: string | null;
  }) {
    await createInstance(input);
  }

  return (
    <>
      <div className="grid gap-4">
        <Card className="rounded-3xl border-white/8 bg-white/[0.03] shadow-panel">
          <CardHeader className="p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="library-search">Search</Label>
                  <Input
                    className="h-10 rounded-2xl border-white/10 bg-[#11161c]"
                    id="library-search"
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t(lang, "searchPlaceholder")}
                    value={search}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="library-loader-filter">Loader</Label>
                  <Select
                    value={loaderFilter}
                    onValueChange={(value) => {
                      if (!value) return;
                      setLoaderFilter(value);
                    }}
                  >
                    <SelectTrigger className="h-10 rounded-2xl border-white/10 bg-[#11161c]" id="library-loader-filter">
                      <SelectValue placeholder={t(lang, "allLoaders")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t(lang, "allLoaders")}</SelectItem>
                      <SelectItem value="vanilla">Vanilla</SelectItem>
                      <SelectItem value="fabric">Fabric</SelectItem>
                      <SelectItem value="forge">Forge</SelectItem>
                      <SelectItem value="neoforge">NeoForge</SelectItem>
                      <SelectItem value="quilt">Quilt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="library-sort">Sort</Label>
                  <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
                    <SelectTrigger className="h-10 rounded-2xl border-white/10 bg-[#11161c]" id="library-sort">
                      <SelectValue placeholder={t(lang, "sortUpdated")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="updated">{t(lang, "sortUpdated")}</SelectItem>
                      <SelectItem value="name">{t(lang, "sortName")}</SelectItem>
                      <SelectItem value="version">{t(lang, "sortVersion")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <ButtonGroup>
                  <Button
                    onClick={() => setViewMode("cards")}
                    size="sm"
                    type="button"
                    variant={viewMode === "cards" ? "default" : "outline"}
                  >
                    <LayoutGrid className="h-4 w-4" />
                    {t(lang, "cards")}
                  </Button>
                  <Button
                    onClick={() => setViewMode("table")}
                    size="sm"
                    type="button"
                    variant={viewMode === "table" ? "default" : "outline"}
                  >
                    <List className="h-4 w-4" />
                    {t(lang, "table")}
                  </Button>
                </ButtonGroup>

                <div className="text-sm text-textMuted">
                  {rows.length} of {instances.length}
                </div>

                <Button className="rounded-2xl" onClick={() => setCreateOpen(true)} type="button">
                  <Plus className="h-4 w-4" />
                  New Instance
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {rows.length === 0 ? (
          <Card className="rounded-3xl border-white/8 bg-white/[0.03] shadow-panel">
            <CardContent className="grid gap-2 p-8 text-center">
              <div className="text-base font-semibold text-text">{t(lang, "noInstances")}</div>
              <div className="text-sm text-textMuted">{t(lang, "noInstancesHint")}</div>
              <div>
                <Button className="rounded-2xl" onClick={() => setCreateOpen(true)} type="button">
                  <Plus className="h-4 w-4" />
                  Create Instance
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : viewMode === "cards" ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((instance) => (
              <InstanceCard
                key={instance.id}
                instance={instance}
                lang={lang}
                presetName={instance.presetId ? (presetById[instance.presetId] ?? instance.presetId) : null}
              />
            ))}
          </section>
        ) : (
          <Card className="overflow-hidden rounded-3xl border-white/8 bg-white/[0.03] shadow-panel">
            <CardContent className="p-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Loader</TableHead>
                    <TableHead>{t(lang, "preset")}</TableHead>
                    <TableHead>{t(lang, "lastPlayed")}</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((instance) => (
                    <TableRow key={instance.id}>
                      <TableCell>
                        <div className="font-medium text-text">{instance.name}</div>
                        <div className="mt-1 text-xs text-textMuted">{instance.modpackName ?? "No pack name"}</div>
                      </TableCell>
                      <TableCell>{instance.mcVersion}</TableCell>
                      <TableCell>{instance.loader}</TableCell>
                      <TableCell>{instance.presetId ? (presetById[instance.presetId] ?? instance.presetId) : "None"}</TableCell>
                      <TableCell>{formatDateTime(instance.lastPlayedAt, lang)}</TableCell>
                      <TableCell>{formatDateTime(instance.updatedAt, lang)}</TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-2">
                          <Button
                            onClick={() => void launchInstance(instance.id)}
                            size="sm"
                            type="button"
                          >
                            Play
                          </Button>
                          <Button asChild size="sm" type="button" variant="outline">
                            <Link to={`/instances/${instance.id}`}>{t(lang, "open")}</Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <CreateInstanceSheet lang={lang} onCreate={handleCreate} onOpenChange={setCreateOpen} open={createOpen} />
    </>
  );
}
