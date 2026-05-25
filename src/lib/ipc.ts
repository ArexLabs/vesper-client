import type { AppState, Instance } from "@/lib/schemas";
import { modrinthClient } from "@/lib/modrinth";
import type { Labrinth } from "@modrinth/api-client";

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

// ---------------------------------------------------------------------------
// Auth Types (mirrors Rust `entra_config` and `commands::auth`)
// ---------------------------------------------------------------------------

export interface MicrosoftProfile {
  id: string;
  displayName: string;
  email: string | null;
  tenantId: string | null;
  minecraftUsername: string | null;
}

export interface TokenInfo {
  expiresAt: number;
  scopes: string;
  isExpired: boolean;
}

export interface AuthStatus {
  isLoggedIn: boolean;
  profile: MicrosoftProfile | null;
  tokenInfo: TokenInfo | null;
  secureStorageAvailable: boolean;
  message: string | null;
}

export interface DeviceLoginStart {
  sessionId: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string | null;
  expiresInSeconds: number;
  intervalSeconds: number;
  message: string;
}

export interface DeviceLoginPoll {
  status: "pending" | "complete" | "error";
  profile: MicrosoftProfile | null;
  retryAfterSeconds: number | null;
  message: string | null;
}

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

export async function secureStorageProbe(key = "ms-refresh-token") {
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

// ---------------------------------------------------------------------------
// Auth IPC
// ---------------------------------------------------------------------------

export async function getAuthStatusNative(): Promise<AuthStatus> {
  return await invokeOrThrow<AuthStatus>("auth_get_status");
}

export async function beginMicrosoftDeviceLoginNative(): Promise<DeviceLoginStart> {
  return await invokeOrThrow<DeviceLoginStart>("auth_begin_microsoft_device_login");
}

export async function pollMicrosoftDeviceLoginNative(
  sessionId: string,
): Promise<DeviceLoginPoll> {
  return await invokeOrThrow<DeviceLoginPoll>("auth_poll_microsoft_device_login", {
    sessionId,
  });
}

export async function refreshMicrosoftTokenNative(): Promise<AuthStatus> {
  return await invokeOrThrow<AuthStatus>("auth_refresh_token");
}

export async function logoutMicrosoftNative(): Promise<AuthStatus> {
  return await invokeOrThrow<AuthStatus>("auth_logout_microsoft");
}

export async function cancelDeviceLoginNative(sessionId: string): Promise<void> {
  return await invokeOrThrow<void>("auth_cancel_device_login", { sessionId });
}

// ---------------------------------------------------------------------------
// Modrinth search / discovery
// ---------------------------------------------------------------------------

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

function mapModrinthHit(hit: Labrinth.Projects.v2.SearchResultHit): DiscoverSearchResult | null {
  const projectId = hit.project_id;
  if (!projectId) return null;
  return {
    source: "modrinth",
    projectId,
    title: hit.title,
    summary: hit.description,
    downloads: hit.downloads,
    iconUrl: hit.icon_url || null,
    url: hit.slug ? `https://modrinth.com/mod/${hit.slug}` : null,
    author: hit.author ?? null,
  };
}

export async function discoverSearchModrinthNative(
  input: DiscoverSearchInput,
): Promise<DiscoverSearchResult[]> {
  try {
    return await invokeOrThrow<DiscoverSearchResult[]>("discover_search_modrinth", { input });
  } catch {
    const q = input.query.trim();
    if (!q) return [];
    const facets = toModrinthFacets(input);
    const result = await modrinthClient.labrinth.projects_v2.search({
      query: q,
      index: "relevance",
      facets,
      limit: Math.min(Math.max(input.limit ?? 20, 1), 60),
    });
    return result.hits.map(mapModrinthHit).filter((item): item is DiscoverSearchResult => Boolean(item));
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
