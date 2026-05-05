import type { AppState, Instance } from "@/lib/schemas";

const STORAGE_KEY = "vesper-launcher-state-v1";

export type CreateInstanceInput = {
  name: string;
  mcVersion: string;
  loader: Instance["loader"];
  modpackName?: string | null;
};

export type LaunchPreview = {
  status: "placeholder" | "local-fallback" | "launcher-opened";
  instanceId: string;
  commandPreview: string[];
  note: string;
};

export type RuntimeAuthStatus = {
  profile: unknown | null;
  loginAvailable: boolean;
  secureStorageAvailable: boolean;
  microsoftClientConfigured: boolean;
  message: string | null;
};

export type MicrosoftDeviceLoginStart = {
  sessionId: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string | null;
  expiresInSeconds: number;
  intervalSeconds: number;
  message: string;
};

export type MicrosoftDeviceLoginPoll = {
  status: "pending" | "complete" | "error";
  profile: unknown | null;
  retryAfterSeconds: number | null;
  message: string | null;
};

export type DiscoverSearchInput = {
  query: string;
  loader?: string | null;
  gameVersion?: string | null;
  limit?: number | null;
};

export type DiscoverSearchResult = {
  source: "modrinth";
  projectId: string;
  title: string;
  summary: string;
  downloads: number;
  iconUrl: string | null;
  url: string | null;
  author: string | null;
};

export type DiscoverDownloadResult = {
  source: "modrinth";
  projectId: string;
  fileName: string;
  filePath: string;
  sizeBytes: number | null;
  url: string;
  message: string;
};

function hasTauriRuntime() {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window || navigator.userAgent.includes("Tauri");
}

async function getInvoke() {
  if (!hasTauriRuntime()) return null;
  const mod = await import("@tauri-apps/api/core");
  return mod.invoke;
}

async function invokeOrThrow<T>(command: string, args?: Record<string, unknown>) {
  const invoke = await getInvoke();
  if (!invoke) throw new Error("Tauri runtime unavailable");
  return await invoke<T>(command, args);
}

export async function loadAppStateFromRuntime() {
  try {
    const value = await invokeOrThrow<unknown>("load_app_state");
    if (value && typeof value === "object") return value;
  } catch {
    // fallback
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveAppStateToRuntime(state: AppState) {
  try {
    await invokeOrThrow<boolean>("save_app_state", { state });
  } catch {
    // ignore and always write local fallback
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return true;
}

export async function listInstancesNative(): Promise<Instance[]> {
  try {
    return await invokeOrThrow<Instance[]>("list_instances");
  } catch {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as { instances?: Instance[] };
      return parsed.instances ?? [];
    } catch {
      return [];
    }
  }
}

export async function createInstanceNative(input: CreateInstanceInput): Promise<unknown | null> {
  try {
    return await invokeOrThrow("create_instance", { input });
  } catch {
    return null;
  }
}

export async function launchInstanceNative(instanceId: string): Promise<LaunchPreview> {
  try {
    return await invokeOrThrow<LaunchPreview>("launch_instance", { instanceId });
  } catch {
    return {
      status: "local-fallback",
      instanceId,
      commandPreview: ["java", "-jar", "<launcher>.jar"],
      note: "Local launch preview (desktop runtime unavailable).",
    };
  }
}

export async function secureStorageProbe(key = "ms-auth-refresh-token-placeholder") {
  try {
    return await invokeOrThrow("secure_store_read_placeholder", { key });
  } catch {
    return {
      available: false,
      provider: "none",
      message: "Tauri secure storage placeholder is not reachable in web mode.",
      key,
    };
  }
}

export function isTauriRuntime() {
  return hasTauriRuntime();
}

export async function getAuthStatusNative(): Promise<RuntimeAuthStatus> {
  return await invokeOrThrow<RuntimeAuthStatus>("auth_get_status");
}

export async function beginMicrosoftDeviceLoginNative(): Promise<MicrosoftDeviceLoginStart> {
  return await invokeOrThrow<MicrosoftDeviceLoginStart>("auth_begin_microsoft_device_login");
}

export async function pollMicrosoftDeviceLoginNative(sessionId: string): Promise<MicrosoftDeviceLoginPoll> {
  return await invokeOrThrow<MicrosoftDeviceLoginPoll>("auth_poll_microsoft_device_login", { sessionId });
}

export async function logoutMicrosoftNative(): Promise<RuntimeAuthStatus> {
  return await invokeOrThrow<RuntimeAuthStatus>("auth_logout_microsoft");
}

function toModrinthFacets(input: DiscoverSearchInput) {
  const facets: string[][] = [["project_type:mod"]];
  const loader = input.loader?.trim().toLowerCase();
  if (loader && loader !== "all" && loader !== "vanilla") {
    facets.push([`categories:${loader}`]);
  }
  const version = input.gameVersion?.trim();
  if (version && version !== "all") {
    facets.push([`versions:${version}`]);
  }
  return facets;
}

function mapModrinthHit(raw: unknown): DiscoverSearchResult | null {
  if (!raw || typeof raw !== "object") return null;
  const hit = raw as Record<string, unknown>;
  const projectId = String(hit.project_id ?? hit.id ?? "");
  if (!projectId) return null;
  const slug = typeof hit.slug === "string" ? hit.slug : "";
  const downloads = typeof hit.downloads === "number" ? hit.downloads : 0;
  return {
    source: "modrinth",
    projectId,
    title: String(hit.title ?? "Untitled"),
    summary: String(hit.description ?? ""),
    downloads: Number.isFinite(downloads) ? downloads : 0,
    iconUrl: typeof hit.icon_url === "string" ? hit.icon_url : null,
    url: slug ? `https://modrinth.com/mod/${slug}` : null,
    author: typeof hit.author === "string" ? hit.author : null,
  };
}

export async function discoverSearchModrinthNative(input: DiscoverSearchInput): Promise<DiscoverSearchResult[]> {
  try {
    return await invokeOrThrow<DiscoverSearchResult[]>("discover_search_modrinth", { input });
  } catch {
    const q = input.query.trim();
    if (!q) return [];
    const facets = toModrinthFacets(input);
    const url = new URL("https://api.modrinth.com/v2/search");
    url.searchParams.set("query", q);
    url.searchParams.set("index", "relevance");
    url.searchParams.set("limit", String(Math.min(Math.max(input.limit ?? 20, 1), 60)));
    url.searchParams.set("facets", JSON.stringify(facets));
    const response = await fetch(url.toString(), { method: "GET" });
    if (!response.ok) {
      throw new Error(`Modrinth search failed (${response.status})`);
    }
    const body = (await response.json()) as { hits?: unknown[] };
    return (body.hits ?? []).map(mapModrinthHit).filter((item): item is DiscoverSearchResult => Boolean(item));
  }
}

export async function discoverDownloadModrinthNative(
  projectId: string,
  options?: { loader?: string | null; gameVersion?: string | null },
): Promise<DiscoverDownloadResult> {
  return await invokeOrThrow<DiscoverDownloadResult>("discover_download_modrinth", {
    input: {
      projectId,
      loader: options?.loader ?? null,
      gameVersion: options?.gameVersion ?? null,
    },
  });
}
