import {
  type DiscoverDownloadResult,
  type DiscoverSearchResult,
  discoverDownloadCurseforgeNative,
  discoverDownloadModrinthNative,
  discoverSearchCurseforgeNative,
  discoverSearchModrinthNative,
} from "@/lib/ipc";
import { useLauncherStore } from "@/store/launcher-store";
import { useEffect, useState } from "react";

export type UseUnifiedSearchOptions = {
  platform: "all" | "modrinth" | "curseforge";
  query: string;
  loader?: string | null;
  gameVersion?: string | null;
  limit?: number;
  offset?: number;
};

export function useUnifiedSearch(options: UseUnifiedSearchOptions) {
  const [results, setResults] = useState<DiscoverSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installMessage, setInstallMessage] = useState<string | null>(null);

  // Pagination State
  const [page, setPage] = useState(0);

  const globalVersionFilter = useLauncherStore((s) => s.data.globalDefaults.globalVersionFilter);
  const effectiveVersion = globalVersionFilter ?? options.gameVersion;

  // Reset page to 0 if any filter criteria changes
  useEffect(() => {
    setPage(0);
    setResults([]);
  }, [effectiveVersion, options.limit, options.loader, options.query, options.platform]);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const queryParams = {
          gameVersion: effectiveVersion,
          limit: options.limit,
          offset: options.limit ? page * options.limit : undefined,
          loader: options.loader,
          query: options.query.trim(),
        };

        let modrinthPromise: Promise<DiscoverSearchResult[]> = Promise.resolve([]);
        let curseforgePromise: Promise<DiscoverSearchResult[]> = Promise.resolve([]);

        if (options.platform === "all" || options.platform === "modrinth") {
          modrinthPromise = discoverSearchModrinthNative(queryParams).catch(() => []);
        }

        if (options.platform === "all" || options.platform === "curseforge") {
          curseforgePromise = discoverSearchCurseforgeNative(queryParams).catch(() => []);
        }

        const [mrHits, cfHits] = await Promise.all([modrinthPromise, curseforgePromise]);

        if (!active) return;

        // Interleave the results 1 by 1 for a mixed "all" view
        const newResults: DiscoverSearchResult[] = [];
        const maxLen = Math.max(mrHits.length, cfHits.length);
        for (let i = 0; i < maxLen; i++) {
          if (i < mrHits.length) newResults.push(mrHits[i]);
          if (i < cfHits.length) newResults.push(cfHits[i]);
        }

        // Append new results to the existing ones
        setResults((prev) => (page === 0 ? newResults : [...prev, ...newResults]));
      } catch (searchError) {
        if (!active) return;
        if (page === 0) setResults([]);
        setError(searchError instanceof Error ? searchError.message : "Search failed.");
      } finally {
        if (!active) return;
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [effectiveVersion, options.limit, options.loader, options.query, options.platform, page]);

  // Expose a loadMore function
  function loadMore() {
    if (!loading && !error) {
      setPage((p) => p + 1);
    }
  }

  async function installProject(project: DiscoverSearchResult) {
    setInstallingId(project.projectId);
    setInstallMessage(null);
    setError(null);

    try {
      let result: DiscoverDownloadResult | null = null;
      if (project.source === "modrinth") {
        result = await discoverDownloadModrinthNative(project.projectId, {
          gameVersion: effectiveVersion,
          loader: options.loader,
        });
      } else if (project.source === "curseforge") {
        result = await discoverDownloadCurseforgeNative(project.projectId, {
          gameVersion: effectiveVersion,
          loader: options.loader,
        });
      }

      if (result) {
        setInstallMessage(`${project.title} saved to ${result.filePath}`);
      }
      return result;
    } catch (installError) {
      const message = installError instanceof Error ? installError.message : "Install failed.";
      setError(message);
      return null;
    } finally {
      setInstallingId(null);
    }
  }

  function clearInstallMessage() {
    setInstallMessage(null);
  }

  return {
    clearInstallMessage,
    error,
    installMessage,
    installingId,
    installProject,
    loadMore,
    loading,
    results,
  };
}
