import { discoverDownloadModrinthNative } from "@/lib/ipc";
import {
  type ModrinthProject,
  type ModrinthSearchSort,
  searchModrinthProjects,
} from "@/lib/modrinth";
import { useEffect, useState } from "react";

type UseModrinthSearchOptions = {
  query: string;
  loader?: string | null;
  gameVersion?: string | null;
  sort?: ModrinthSearchSort;
  limit?: number;
};

export function useModrinthSearch(options: UseModrinthSearchOptions) {
  const [results, setResults] = useState<ModrinthProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installMessage, setInstallMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const items = await searchModrinthProjects({
          gameVersion: options.gameVersion,
          limit: options.limit,
          loader: options.loader,
          query: options.query.trim(),
          sort: options.sort,
        });
        if (!active) return;
        setResults(items);
      } catch (searchError) {
        if (!active) return;
        setResults([]);
        setError(searchError instanceof Error ? searchError.message : "Modrinth search failed.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [options.gameVersion, options.limit, options.loader, options.query, options.sort]);

  async function installProject(project: ModrinthProject) {
    setInstallingId(project.id);
    setInstallMessage(null);
    setError(null);

    try {
      const result = await discoverDownloadModrinthNative(project.id, {
        gameVersion: options.gameVersion,
        loader: options.loader,
      });
      setInstallMessage(`${project.title} saved to ${result.filePath}`);
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
    loading,
    results,
  };
}

export type { ModrinthProject, ModrinthSearchSort };
