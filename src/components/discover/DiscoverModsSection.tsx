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
import { useModrinthSearch } from "@/hooks/use-modrinth-search";
import { fetchLoaderOptions, fetchMinecraftVersions } from "@/lib/minecraft-catalog";
import { cn } from "@/lib/utils";
import { ExternalLink, Search } from "lucide-react";
import { useEffect, useState } from "react";

type DiscoverModsSectionProps = {
  compact?: boolean;
  initialQuery?: string;
  initialLoader?: string;
  initialGameVersion?: string;
};

export function DiscoverModsSection({
  compact = false,
  initialQuery = "",
  initialLoader = "all",
  initialGameVersion = "all",
}: DiscoverModsSectionProps) {
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<"relevance" | "downloads" | "follows" | "updated">("downloads");
  const [loader, setLoader] = useState(initialLoader);
  const [gameVersion, setGameVersion] = useState(initialGameVersion);
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
    loading,
    results,
  } = useModrinthSearch({
    gameVersion,
    limit: compact ? 6 : 12,
    loader,
    query,
    sort,
  });

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
    <Card className="overflow-hidden rounded-3xl border-white/8 bg-white/[0.03] shadow-panel">
      <CardHeader className="space-y-4 p-5">
        <div className="space-y-1">
          <CardTitle className="text-xl font-semibold text-text">Discover Mods</CardTitle>
          <p className="text-sm text-textMuted">
            Search Modrinth and install directly into the client download cache.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_180px_180px_180px]">
          <div className="space-y-2">
            <Label htmlFor={compact ? "discover-mod-search-home" : "discover-mod-search-explore"}>
              Search
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-textMuted" />
              <Input
                id={compact ? "discover-mod-search-home" : "discover-mod-search-explore"}
                className="h-10 rounded-2xl border-border bg-surface2 pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search Modrinth mods"
                value={query}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={compact ? "discover-sort-home" : "discover-sort-explore"}>Sort</Label>
            <Select value={sort} onValueChange={(value) => setSort(value as typeof sort)}>
              <SelectTrigger
                className="h-10 rounded-2xl border-border bg-surface2"
                id={compact ? "discover-sort-home" : "discover-sort-explore"}
              >
                <SelectValue>
                  {sort === "downloads"
                    ? "Most downloaded"
                    : sort === "follows"
                      ? "Most followed"
                      : sort === "updated"
                        ? "Recently updated"
                        : "Best match"}
                </SelectValue>
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
                className="h-10 rounded-2xl border-border bg-surface2"
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
                className="h-10 rounded-2xl border-border bg-surface2"
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

      <CardContent className="min-h-0 space-y-4 p-5 pt-0">
        {installMessage ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">
            <span>{installMessage}</span>
            <Button onClick={clearInstallMessage} size="sm" type="button" variant="ghost">
              Dismiss
            </Button>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div
            className={cn(
              "overflow-y-auto pr-1 [scrollbar-gutter:stable]",
              compact ? "max-h-120" : "max-h-[calc(100vh-19rem)]",
            )}
          >
            <div
              className={
                compact ? "grid gap-3 md:grid-cols-2" : "grid gap-3 md:grid-cols-2 xl:grid-cols-3"
              }
            >
              {Array.from({ length: compact ? 4 : 6 }).map((_, i) => (
                <div
                  key={`skeleton-${compact ? "compact" : "full"}-${i}`}
                  className="rounded-3xl border border-border bg-surface1 p-4"
                >
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
          <div className="rounded-2xl border border-border bg-surface1 px-4 py-8 text-center text-sm text-textMuted">
            No mods matched the current filters.
          </div>
        ) : (
          <div
            className={cn(
              "overflow-y-auto pr-1 [scrollbar-gutter:stable]",
              compact ? "max-h-120" : "max-h-[calc(100vh-19rem)]",
            )}
          >
            <div
              className={
                compact ? "grid gap-3 md:grid-cols-2" : "grid gap-3 md:grid-cols-2 xl:grid-cols-3"
              }
            >
              {results.map((project) => (
                <article
                  key={project.id}
                  className="rounded-3xl border border-border bg-surface1 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface2">
                      {project.iconUrl ? (
                        <img
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                          src={project.iconUrl}
                        />
                      ) : (
                        <span className="text-xs font-semibold text-textMuted">MOD</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold text-text">{project.title}</h3>
                      <p className="truncate text-xs text-textMuted">
                        {project.author ?? "Unknown author"}
                      </p>
                      <p className="mt-2 text-xs text-textMuted">
                        {project.downloads.toLocaleString()} downloads
                        {project.followers > 0
                          ? ` · ${project.followers.toLocaleString()} followers`
                          : ""}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 line-clamp-3 min-h-[3.75rem] text-sm leading-6 text-textMuted">
                    {project.summary || "No description available."}
                  </p>

                  <div className="mt-4 flex gap-2">
                    <Button
                      className="flex-1 rounded-2xl"
                      disabled={installingId === project.id}
                      onClick={() => void installProject(project)}
                      type="button"
                    >
                      {installingId === project.id ? "Installing..." : "Install"}
                    </Button>
                    <Button
                      className="rounded-2xl"
                      disabled={!project.url}
                      onClick={() => {
                        if (!project.url) return;
                        window.open(project.url, "_blank", "noopener,noreferrer");
                      }}
                      type="button"
                      variant="outline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
