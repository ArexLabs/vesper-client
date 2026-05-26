import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/lib/i18n";
import type { Instance } from "@/lib/schemas";
import { useLauncherStore } from "@/store/launcher-store";
import {
  Search,
  Plus,
  LayoutGrid,
  List,
  SortAsc,
  Filter,
  PackagePlus,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { InstanceCard } from "@/components/instances/InstanceCard";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ViewMode = "cards" | "table";
type SortMode = "updated" | "name" | "version";

export function InstancesPage() {
  const { t } = useT();
  const instances = useLauncherStore((s) => s.data.instances);
  const presets = useLauncherStore((s) => s.data.presets);
  const createInstance = useLauncherStore((s) => s.createInstance);

  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [sortMode, setSortMode] = useState<SortMode>("updated");
  const [search, setSearch] = useState("");
  const [loaderFilter, setLoaderFilter] = useState<string>("all");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
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
    setIsCreateOpen(false);
  }

  return (
    <div className="flex flex-col gap-6 motion-preset-fade motion-duration-500">
      {/* Header Section */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            {t("instanceLibrary")}
            <Badge
              variant="outline"
              className="ml-2 rounded-lg bg-white/5 font-mono text-[10px] tracking-widest text-primary"
            >
              {instances.length} TOTAL
            </Badge>
          </h1>
          <p className="text-sm text-textMuted">
            Explore and manage your local Minecraft environments.
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger
            render={
              <Button className="rounded-2xl bg-primary px-6 py-6 font-bold text-black shadow-glow hover:scale-[1.02] active:scale-[0.98] transition-transform">
                <Plus className="mr-2 h-5 w-5" />
                {t("createInstance")}
              </Button>
            }
          />
          <DialogContent className="rounded-[32px] border-border bg-surface1 p-0 overflow-hidden sm:max-w-[500px] w-[calc(100%-2rem)]">
            <div className="relative h-24 sm:h-32 w-full bg-linear-to-br from-primary/20 via-primary/5 to-transparent p-6 sm:p-8">
              <div className="absolute right-6 top-6 sm:right-8 sm:top-8 opacity-20">
                <PackagePlus className="h-16 w-16 sm:h-24 sm:w-24 text-primary" />
              </div>
              <DialogTitle className="text-xl sm:text-2xl font-bold text-white">
                {t("createInstance")}
              </DialogTitle>
              <DialogDescription className="text-primary/70 font-medium text-xs sm:text-sm">
                Configure your new environment.
              </DialogDescription>
            </div>
            <div className="grid gap-4 sm:gap-6 p-6 sm:p-8">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <label
                    htmlFor="instance-name"
                    className="text-xs font-bold uppercase tracking-widest text-textMuted"
                  >
                    Instance Name
                  </label>
                  <Input
                    id="instance-name"
                    placeholder="Survival 1.20..."
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="h-12 rounded-2xl border-border bg-surface2 px-4 shadow-inner"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="mc-version"
                      className="text-xs font-bold uppercase tracking-widest text-textMuted"
                    >
                      MC Version
                    </label>
                    <Input
                      id="mc-version"
                      placeholder="1.20.1"
                      value={newVersion}
                      onChange={(e) => setNewVersion(e.target.value)}
                      className="h-12 rounded-2xl border-border bg-surface2 px-4"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-textMuted">
                      Loader
                    </label>
                    <Select
                      value={newLoader}
                      onValueChange={(val) =>
                        setNewLoader(val as Instance["loader"])
                      }
                    >
                      <SelectTrigger className="h-12 rounded-2xl border-border bg-surface2 px-4">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-border bg-surface2">
                        <SelectItem
                          value="fabric"
                          className="rounded-xl italic"
                        >
                          Fabric
                        </SelectItem>
                        <SelectItem value="forge" className="rounded-xl">
                          Forge
                        </SelectItem>
                        <SelectItem value="neoforge" className="rounded-xl">
                          NeoForge
                        </SelectItem>
                        <SelectItem value="quilt" className="rounded-xl">
                          Quilt
                        </SelectItem>
                        <SelectItem value="vanilla" className="rounded-xl">
                          Vanilla
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="modpack-name"
                    className="text-xs font-bold uppercase tracking-widest text-textMuted"
                  >
                    Pack Name (Optional)
                  </label>
                  <Input
                    id="modpack-name"
                    placeholder="Modpack Name"
                    value={newModpackName}
                    onChange={(e) => setNewModpackName(e.target.value)}
                    className="h-12 rounded-2xl border-border bg-surface2 px-4"
                  />
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button
                  onClick={() => void onCreate()}
                  disabled={!newName.trim() || !newVersion.trim()}
                  className="h-12 flex-1 rounded-2xl bg-primary font-bold text-black shadow-glow"
                >
                  Initialize Instance
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Toolbar Section */}
      <div className="flex flex-col gap-4 min-[1100px]:flex-row min-[1100px]:items-center">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-textMuted transition-colors group-focus-within:text-primary" />
          <Input
            className="h-12 w-full rounded-2xl border-border/50 bg-surface1/50 pl-11 pr-4 transition-all focus:border-primary/50 focus:bg-surface1 focus:ring-0"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-2xl border border-border/50 bg-surface1/50 p-1 min-w-[280px]">
            <Select
              value={loaderFilter}
              onValueChange={(val) => setLoaderFilter(val ?? "all")}
            >
              <SelectTrigger className="h-10 flex-1 border-none bg-transparent focus:ring-0">
                <Filter className="mr-2 h-3.5 w-3.5 text-textMuted" />
                <SelectValue placeholder="Loader" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-border bg-surface2">
                <SelectItem value="all" className="rounded-xl">
                  All Loaders
                </SelectItem>
                <SelectItem value="fabric" className="rounded-xl">
                  Fabric
                </SelectItem>
                <SelectItem value="forge" className="rounded-xl">
                  Forge
                </SelectItem>
                <SelectItem value="neoforge" className="rounded-xl">
                  NeoForge
                </SelectItem>
                <SelectItem value="quilt" className="rounded-xl">
                  Quilt
                </SelectItem>
                <SelectItem value="vanilla" className="rounded-xl">
                  Vanilla
                </SelectItem>
              </SelectContent>
            </Select>
            <div className="h-4 w-px bg-border" />
            <Select
              value={sortMode}
              onValueChange={(v) => setSortMode((v as SortMode) ?? "updated")}
            >
              <SelectTrigger className="h-10 flex-1 border-none bg-transparent focus:ring-0">
                <SortAsc className="mr-2 h-3.5 w-3.5 text-textMuted" />
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-border bg-surface2">
                <SelectItem value="updated" className="rounded-xl">
                  Updated
                </SelectItem>
                <SelectItem value="name" className="rounded-xl">
                  Name
                </SelectItem>
                <SelectItem value="version" className="rounded-xl">
                  Version
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1 rounded-2xl border border-border/50 bg-surface1/50 p-1">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-xl transition-all",
                viewMode === "cards"
                  ? "bg-primary/20 text-primary shadow-glow-sm"
                  : "text-textMuted hover:text-white",
              )}
              onClick={() => setViewMode("cards")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-xl transition-all",
                viewMode === "table"
                  ? "bg-primary/20 text-primary shadow-glow-sm"
                  : "text-textMuted hover:text-white",
              )}
              onClick={() => setViewMode("table")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Grid / Table Content */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[40px] border-2 border-dashed border-border/50 bg-surface1/20 py-24 text-center">
          <div className="mb-6 grid h-20 w-20 place-items-center rounded-3xl bg-surface2 text-textMuted/20">
            <Sparkles className="h-10 w-10" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-white">
            {t("noInstances")}
          </h3>
          <p className="max-w-xs text-sm text-textMuted">
            {t("noInstancesHint")}
          </p>
          <Button
            variant="outline"
            className="mt-8 rounded-xl border-primary/20 text-primary hover:bg-primary/10"
            onClick={() => setIsCreateOpen(true)}
          >
            Create your first instance
          </Button>
        </div>
      ) : viewMode === "cards" ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((instance) => (
            <InstanceCard
              key={instance.id}
              instance={instance}
              presetName={
                instance.presetId
                  ? (presetById[instance.presetId] ?? instance.presetId)
                  : null
              }
              className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4"
            />
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden rounded-[32px] border-border bg-surface1/50 shadow-soft">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/5 bg-white/2">
                    <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-textMuted">
                      Instance
                    </th>
                    <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-textMuted">
                      Version
                    </th>
                    <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-textMuted">
                      Loader
                    </th>
                    <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-textMuted">
                      Preset
                    </th>
                    <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-textMuted text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rows.map((instance) => (
                    <tr
                      key={instance.id}
                      className="group transition-colors hover:bg-white/2"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface2 text-primary">
                            <PackagePlus className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-bold text-white group-hover:text-primary transition-colors">
                              {instance.name}
                            </div>
                            <div className="text-[11px] text-textMuted">
                              {instance.modpackName ?? "—"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-text">
                        {instance.mcVersion}
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant="ghost"
                          className="bg-surface3 text-[10px] rounded-md border-border/50 uppercase tracking-tighter"
                        >
                          {instance.loader}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        {instance.presetId ? (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 shadow-glow-sm" />
                            <span className="text-xs font-semibold text-textMuted">
                              {presetById[instance.presetId] ??
                                instance.presetId}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-textMuted opacity-50">
                            Default
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          render={<Link to={`/instances/${instance.id}`} />}
                          size="sm"
                          variant="outline"
                          className="rounded-xl border-border bg-surface2/50 group-hover:border-primary/30 group-hover:bg-primary/10 group-hover:text-primary transition-all"
                        >
                          Manage
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
