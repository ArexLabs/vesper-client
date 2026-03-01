import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useUnifiedSearch } from "@/hooks/use-unified-search";
import { fetchLoaderOptions, fetchMinecraftVersions } from "@/lib/minecraft-catalog";
import { cn } from "@/lib/utils";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type DiscoverModsSectionProps = {
  compact?: boolean;
  initialQuery?: string;
};

export function DiscoverModsSection({
  compact = false,
  initialQuery = "",
}: DiscoverModsSectionProps) {
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<"relevance" | "downloads" | "follows" | "updated">("downloads");
  const [platform, setPlatform] = useState<"all" | "modrinth" | "curseforge">("all");
  const [loader, setLoader] = useState("all");
  const [gameVersion, setGameVersion] = useState("all");
  const [loaderOptions, setLoaderOptions] = useState<string[]>([
    "all",
    "vanilla",
    "fabric",
    "forge",
    "neoforge",
    "quilt",
  ]);
  const [versions, setVersions] = useState<string[]>([]);

  const {
    clearInstallMessage,
    error,
    installMessage,
    installingId,
    installProject,
    loadMore,
    loading,
    results,
  } = useUnifiedSearch({
    platform,
    gameVersion: gameVersion === "all" ? null : gameVersion,
    limit: compact ? 6 : 12,
    loader: loader === "all" ? null : loader,
    query,
  });

  // Watch for install success/error to trigger Sonner toasts
  useEffect(() => {
    if (installMessage) {
      toast.success(installMessage);
      clearInstallMessage();
    }
  }, [installMessage, clearInstallMessage]);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  useEffect(() => {
    let active = true;

    void (async () => {
      const [availableLoaders, availableVersions] = await Promise.allSettled([
        fetchLoaderOptions(),
        fetchMinecraftVersions(40),
      ]);

      if (!active) return;

      if (availableLoaders.status === "fulfilled") {
        setLoaderOptions(["all", ...availableLoaders.value.filter((value) => value !== "all")]);
      }

      if (availableVersions.status === "fulfilled") {
        setVersions(availableVersions.value.map((version) => version.id));
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-background shadow-panel">
      {/* Vesper Subtle Dot Grid */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-20 dark:opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23a0a0a0' fill-opacity='0.4' fill-rule='evenodd'%3E%3Ccircle cx='2' cy='2' r='1'/%3E%3C/g%3E%3C/svg%3E")`,
          maskImage: "linear-gradient(to bottom, black 40%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 40%, transparent 100%)",
        }}
      />

      {/* Vesper Ambient Glow */}
      <div className="pointer-events-none absolute left-1/4 top-0 -z-10 h-96 w-96 rounded-full bg-brand-accent/5 blur-[150px]" />

      <CardHeader className="relative z-10 space-y-4 p-5">
        <div className="space-y-1">
          <CardTitle className="tracking-tight text-xl font-bold text-foreground">
            Discover <span className="text-brand-accent italic">Mods</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Search Modrinth and CurseForge. Install directly into the client download cache.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_150px_150px_150px_150px]">
          <div className="space-y-2">
            <Label htmlFor={compact ? "discover-mod-search-home" : "discover-mod-search-explore"}>
              Search
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-textMuted" />
              <Input
                id={compact ? "discover-mod-search-home" : "discover-mod-search-explore"}
                className="h-10 rounded-2xl border-white/10 bg-[#11161c] pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search Modrinth mods"
                value={query}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={compact ? "discover-platform-home" : "discover-platform-explore"}>
              Platform
            </Label>
            <Select
              value={platform}
              onValueChange={(value) => setPlatform(value as typeof platform)}
            >
              <SelectTrigger
                className="h-10 rounded-2xl border-white/10 bg-[#11161c]"
                id={compact ? "discover-platform-home" : "discover-platform-explore"}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="modrinth">Modrinth</SelectItem>
                <SelectItem value="curseforge">CurseForge</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={compact ? "discover-sort-home" : "discover-sort-explore"}>Sort</Label>
            <Select value={sort} onValueChange={(value) => setSort(value as typeof sort)}>
              <SelectTrigger
                className="h-10 rounded-2xl border-white/10 bg-[#11161c]"
                id={compact ? "discover-sort-home" : "discover-sort-explore"}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="downloads">Most downloaded</SelectItem>
                <SelectItem value="follows">Most followed</SelectItem>
                <SelectItem value="updated">Recently updated</SelectItem>
                <SelectItem value="relevance">Best match</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={compact ? "discover-loader-home" : "discover-loader-explore"}>
              Loader
            </Label>
            <Select
              value={loader}
              onValueChange={(value) => {
                if (!value) return;
                setLoader(value);
              }}
            >
              <SelectTrigger
                className="h-10 rounded-2xl border-white/10 bg-[#11161c]"
                id={compact ? "discover-loader-home" : "discover-loader-explore"}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {loaderOptions.map((loaderOption) => (
                  <SelectItem key={loaderOption} value={loaderOption}>
                    {loaderOption === "all" ? "All loaders" : loaderOption}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={compact ? "discover-version-home" : "discover-version-explore"}>
              Minecraft
            </Label>
            <Select
              value={gameVersion}
              onValueChange={(value) => {
                if (!value) return;
                setGameVersion(value);
              }}
            >
              <SelectTrigger
                className="h-10 rounded-2xl border-white/10 bg-[#11161c]"
                id={compact ? "discover-version-home" : "discover-version-explore"}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All versions</SelectItem>
                {versions.map((version) => (
                  <SelectItem key={version} value={version}>
                    {version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative z-10 min-h-0 space-y-4 p-5 pt-0">
        {loading ? (
          <div
            className={cn(
              "overflow-y-auto pr-1 [scrollbar-gutter:stable]",
              compact ? "max-h-[30rem]" : "max-h-[calc(100vh-19rem)]",
            )}
          >
            <div
              className={
                compact ? "grid gap-3 md:grid-cols-2" : "grid gap-3 md:grid-cols-2 xl:grid-cols-3"
              }
            >
              {Array.from({ length: compact ? 4 : 6 }).map((_, index) => (
                <div key={index} className="rounded-3xl border border-white/8 bg-[#11161c] p-4">
                  <div className="flex gap-3">
                    <Skeleton className="h-12 w-12 rounded-2xl" />
                    <div className="grid flex-1 gap-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                  <Skeleton className="mt-4 h-12 w-full" />
                  <div className="mt-4 flex gap-2">
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-[#11161c] px-4 py-8 text-center text-sm text-textMuted">
            No mods matched the current filters.
          </div>
        ) : (
          <div
            className={cn(
              "overflow-y-auto pr-1 [scrollbar-gutter:stable]",
              compact ? "max-h-[30rem]" : "max-h-[calc(100vh-19rem)]",
            )}
          >
            <div
              className={
                compact ? "grid gap-3 md:grid-cols-2" : "grid gap-3 md:grid-cols-2 xl:grid-cols-3"
              }
            >
              <AnimatePresence>
                {results.map((project, idx) => (
                  <motion.article
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.4, delay: Math.min(idx * 0.05, 0.5) }}
                    key={`${project.source}-${project.projectId}`}
                    className="relative flex flex-col rounded-3xl border border-border bg-background/50 p-4 shadow-sm backdrop-blur-sm transition-all hover:bg-background/80"
                  >
                    {/* Placeholder Dependency Icon */}
                    <div
                      className="group absolute right-3 top-3 cursor-help text-muted-foreground transition-colors hover:text-amber-500"
                      title="Check dependencies after installation"
                    >
                      <ExclamationTriangleIcon className="h-5 w-5" />
                      <div className="pointer-events-none absolute right-0 top-6 w-32 translate-y-2 rounded-lg border border-border bg-popover p-2 text-center text-xs opacity-0 shadow-md transition-all group-hover:translate-y-0 group-hover:opacity-100 z-50">
                        Check Dependencies
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-background">
                        {project.iconUrl ? (
                          <img
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                            src={project.iconUrl}
                          />
                        ) : (
                          <span className="text-xs font-semibold text-muted-foreground uppercase">
                            {project.source.slice(0, 2)}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 pr-6">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-foreground">
                            {project.title}
                          </h3>
                          <span
                            className={cn(
                              "rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                              project.source === "modrinth"
                                ? "bg-green-500/10 text-green-500"
                                : "bg-orange-500/10 text-orange-500",
                            )}
                          >
                            {project.source}
                          </span>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {project.author ?? "Unknown author"}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground font-mono">
                          <span>{project.downloads.toLocaleString()} down</span>
                          <span>·</span>
                          <span className="text-foreground">{project.latestVersion}</span>
                          <span>·</span>
                          <span className="capitalize text-foreground">
                            {project.loaders.slice(0, 2).join(", ")}
                            {project.loaders.length > 2 ? "..." : ""}
                          </span>
                        </p>
                      </div>
                    </div>

                    <p className="mt-4 line-clamp-3 min-h-[3.75rem] text-sm leading-6 text-muted-foreground">
                      {project.summary || "No description available."}
                    </p>

                    <div className="mt-4 flex gap-2">
                      <Button
                        className="flex-1 rounded-2xl bg-foreground text-background font-semibold hover:bg-brand-accent/90 hover:text-white"
                        disabled={installingId === project.projectId}
                        onClick={() => void installProject(project)}
                        type="button"
                      >
                        {installingId === project.projectId ? "Installing..." : "Install"}
                      </Button>
                      <Button
                        className="rounded-2xl border-border hover:bg-muted font-mono"
                        size="icon"
                        disabled={!project.url}
                        onClick={() => {
                          if (!project.url) return;
                          window.open(project.url, "_blank", "noopener,noreferrer");
                        }}
                        type="button"
                        variant="outline"
                        title="Open Webpage"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.article>
                ))}
              </AnimatePresence>
            </div>

            {results.length > 0 && !loading && (
              <div className="mt-6 flex justify-center pb-4">
                <Button
                  onClick={loadMore}
                  variant="outline"
                  className="rounded-full border-border bg-background/50 px-8 backdrop-blur-sm"
                >
                  Load More
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </div>
  );
}
