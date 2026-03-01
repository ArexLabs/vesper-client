export type MinecraftVersionItem = {
  id: string;
  type: "release" | "snapshot" | "old_beta" | "old_alpha";
  releaseTime: string;
};

const DEFAULT_LOADERS = ["vanilla", "fabric", "forge", "neoforge", "quilt"] as const;
const SUPPORTED_LOADER_SET = new Set(DEFAULT_LOADERS);

let cachedVersions: MinecraftVersionItem[] | null = null;
let cachedLoaders: string[] | null = null;

function isMinecraftVersionType(value: string): value is MinecraftVersionItem["type"] {
  return (
    value === "release" || value === "snapshot" || value === "old_beta" || value === "old_alpha"
  );
}

export async function fetchMinecraftVersions(limit = 160): Promise<MinecraftVersionItem[]> {
  if (cachedVersions) {
    return cachedVersions.slice(0, limit);
  }
  const response = await fetch("https://launchermeta.mojang.com/mc/game/version_manifest_v2.json", {
    method: "GET",
  });
  if (!response.ok) {
    throw new Error(`Failed to load Minecraft versions (${response.status})`);
  }

  const body = (await response.json()) as { versions?: Array<Record<string, unknown>> };
  const versions = (body.versions ?? [])
    .map((raw) => {
      const id = typeof raw.id === "string" ? raw.id : "";
      const type =
        typeof raw.type === "string" && isMinecraftVersionType(raw.type) ? raw.type : null;
      const releaseTime = typeof raw.releaseTime === "string" ? raw.releaseTime : "";
      if (!id || !type) return null;
      return { id, type, releaseTime } satisfies MinecraftVersionItem;
    })
    .filter((item): item is MinecraftVersionItem => Boolean(item));

  cachedVersions = versions;
  return versions.slice(0, limit);
}

export async function fetchLoaderOptions(): Promise<string[]> {
  if (cachedLoaders) return cachedLoaders;
  try {
    const response = await fetch("https://api.modrinth.com/v2/tag/loader", { method: "GET" });
    if (!response.ok) {
      throw new Error(`Failed to load Modrinth loader tags (${response.status})`);
    }
    const data = (await response.json()) as string[];
    const picked = data
      .map((item) => item.trim().toLowerCase())
      .filter((item) => SUPPORTED_LOADER_SET.has(item as (typeof DEFAULT_LOADERS)[number]));
    const unique = [...new Set(["vanilla", ...picked])];
    cachedLoaders = unique;
    return unique;
  } catch {
    cachedLoaders = [...DEFAULT_LOADERS];
    return cachedLoaders;
  }
}
