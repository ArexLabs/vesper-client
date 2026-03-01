import { create } from "zustand";
import { buildInstanceSnapshot, diffLauncherConfig, resolveInstanceConfig } from "@/lib/config";
import { makeDefaultState } from "@/lib/dummy";
import {
  type AppState,
  appStateSchema,
  formatZodIssues,
  type Instance,
  instanceSchema,
  type Language,
  type LauncherConfig,
  type Profile,
  launcherConfigPatchSchema,
  launcherConfigSchema,
  profileSchema,
  presetSchema,
  type SettingsSnapshot,
} from "@/lib/schemas";
import {
  beginMicrosoftDeviceLoginNative,
  type CreateInstanceInput,
  type LaunchPreview,
  type MicrosoftDeviceLoginPoll,
  type MicrosoftDeviceLoginStart,
  createInstanceNative,
  getAuthStatusNative,
  launchInstanceNative,
  loadAppStateFromRuntime,
  logoutMicrosoftNative,
  pollMicrosoftDeviceLoginNative,
  saveAppStateToRuntime,
} from "@/lib/ipc";
import { safeRandomId } from "@/lib/utils";

type SaveResult = { ok: true } | { ok: false; error: string; issues?: string[] };
type StoreStatus = "idle" | "loading" | "ready" | "error";

const SEEDED_PLACEHOLDER_INSTANCE_IDS = new Set([
  "inst-vanilla-1204",
  "inst-fabric-qol",
  "inst-fabric-builder",
]);

type LauncherStore = {
  data: AppState;
  status: StoreStatus;
  error: string | null;
  lastLaunchPreview: LaunchPreview | null;
  authRuntimeMessage: string | null;
  boot: () => Promise<void>;
  refreshAuthStatus: () => Promise<void>;
  beginMicrosoftLogin: () => Promise<MicrosoftDeviceLoginStart>;
  pollMicrosoftLogin: (sessionId: string) => Promise<MicrosoftDeviceLoginPoll>;
  logoutMicrosoft: () => Promise<void>;
  createInstance: (input: CreateInstanceInput) => Promise<void>;
  updateGlobalDefaults: (config: LauncherConfig) => Promise<SaveResult>;
  savePresetPatch: (presetId: string, patch: unknown, note?: string) => Promise<SaveResult>;
  rollbackSettingsSnapshot: (snapshotId: string) => Promise<SaveResult>;
  setLanguage: (language: Language) => Promise<void>;
  duplicateInstance: (instanceId: string) => Promise<void>;
  deleteInstance: (instanceId: string) => Promise<void>;
  applyPresetToInstance: (instanceId: string, presetId: string | null) => Promise<SaveResult>;
  saveInstanceResolvedConfig: (instanceId: string, config: unknown, note?: string) => Promise<SaveResult>;
  rollbackInstanceSnapshot: (instanceId: string, snapshotId: string) => Promise<SaveResult>;
  exportPresetJson: (presetId: string) => string | null;
  importPresetJson: (jsonText: string) => Promise<SaveResult>;
  exportInstanceResolvedConfigJson: (instanceId: string) => string | null;
  importInstanceResolvedConfigJson: (instanceId: string, jsonText: string) => Promise<SaveResult>;
  launchInstance: (instanceId: string) => Promise<LaunchPreview | null>;
};

function nowIso() {
  return new Date().toISOString();
}

function clamp<T>(arr: T[], max: number) {
  if (arr.length > max) arr.length = max;
}

function createSettingsSnapshot(args: {
  scope: SettingsSnapshot["scope"];
  note: string;
  presetId?: string | null;
  globalDefaults?: AppState["globalDefaults"] | null;
  presetPatch?: AppState["presets"][number]["configPatch"] | null;
  uiLanguage?: Language | null;
}): SettingsSnapshot {
  return {
    id: safeRandomId("settings-snap"),
    createdAt: nowIso(),
    scope: args.scope,
    presetId: args.presetId ?? null,
    note: args.note,
    globalDefaults: args.globalDefaults ?? null,
    presetPatch: args.presetPatch ?? null,
    uiLanguage: args.uiLanguage ?? null,
  };
}

function makeLocalInstance(input: CreateInstanceInput): Instance {
  const now = nowIso();
  return instanceSchema.parse({
    id: safeRandomId("inst"),
    name: input.name.trim(),
    mcVersion: input.mcVersion.trim(),
    loader: input.loader,
    modpackName: input.modpackName?.trim() ? input.modpackName.trim() : null,
    tags: [input.loader],
    notes: "",
    presetId: null,
    overrides: {},
    snapshots: [],
    createdAt: now,
    updatedAt: now,
    lastPlayedAt: null,
  });
}

function duplicateName(name: string, existingNames: string[]) {
  const baseName = `${name} Copy`;
  if (!existingNames.includes(baseName)) return baseName;

  let suffix = 2;
  while (existingNames.includes(`${baseName} ${suffix}`)) {
    suffix += 1;
  }
  return `${baseName} ${suffix}`;
}

function stripSeededPlaceholderInstances(data: AppState) {
  const instances = data.instances.filter((instance) => !SEEDED_PLACEHOLDER_INSTANCE_IDS.has(instance.id));
  if (instances.length === data.instances.length) return data;
  return appStateSchema.parse({
    ...data,
    instances,
  });
}

export const useLauncherStore = create<LauncherStore>((set, get) => {
  async function persist(data: AppState) {
    try {
      await saveAppStateToRuntime(data);
    } catch (error) {
      set({ error: `Persist failed: ${error instanceof Error ? error.message : String(error)}` });
    }
  }

  function commit(mutator: (draft: AppState) => void) {
    const draft = structuredClone(get().data);
    mutator(draft);
    const parsed = appStateSchema.parse(draft);
    set({ data: parsed });
    void persist(parsed);
    return parsed;
  }

  function parseRuntimeProfile(raw: unknown): Profile | null {
    const parsed = profileSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  }

  function syncMicrosoftProfile(profile: Profile | null) {
    commit((draft) => {
      const index = draft.profiles.findIndex((p) => p.provider === "microsoft");
      if (!profile) {
        if (index >= 0) draft.profiles[index].authState = "signed_out";
        return;
      }
      if (index >= 0) {
        draft.profiles[index] = profile;
      } else {
        draft.profiles.unshift(profile);
      }
    });
  }

  return {
    data: makeDefaultState(),
    status: "idle",
    error: null,
    lastLaunchPreview: null,
    authRuntimeMessage: null,

    async boot() {
      if (get().status === "loading" || get().status === "ready") return;
      set({ status: "loading", error: null });
      try {
        const raw = await loadAppStateFromRuntime();
        if (raw === null) {
          const seeded = makeDefaultState();
          set({ data: seeded, status: "ready" });
          await saveAppStateToRuntime(seeded);
          await get().refreshAuthStatus();
          return;
        }
        const parsed = appStateSchema.safeParse(raw);
        if (!parsed.success) {
          const seeded = makeDefaultState();
          set({
            data: seeded,
            status: "ready",
            error: `Persisted state invalid; reset to defaults (${formatZodIssues(parsed.error.issues)[0] ?? "schema error"})`,
          });
          await saveAppStateToRuntime(seeded);
          await get().refreshAuthStatus();
          return;
        }
        const sanitized = stripSeededPlaceholderInstances(parsed.data);
        set({ data: sanitized, status: "ready" });
        if (sanitized !== parsed.data) {
          await saveAppStateToRuntime(sanitized);
        }
        await get().refreshAuthStatus();
      } catch (error) {
        set({ status: "error", error: error instanceof Error ? error.message : String(error) });
      }
    },

    async refreshAuthStatus() {
      try {
        const status = await getAuthStatusNative();
        const profile = parseRuntimeProfile(status.profile);
        syncMicrosoftProfile(profile);
        set({ authRuntimeMessage: status.message ?? null });
      } catch {
        // Auth commands are unavailable in web mode.
      }
    },

    async beginMicrosoftLogin() {
      const start = await beginMicrosoftDeviceLoginNative();
      set({ authRuntimeMessage: null });
      return start;
    },

    async pollMicrosoftLogin(sessionId) {
      const result = await pollMicrosoftDeviceLoginNative(sessionId);
      if (result.status === "complete") {
        syncMicrosoftProfile(parseRuntimeProfile(result.profile));
      }
      if (result.message) {
        set({ authRuntimeMessage: result.message });
      }
      return result;
    },

    async logoutMicrosoft() {
      const status = await logoutMicrosoftNative();
      syncMicrosoftProfile(parseRuntimeProfile(status.profile));
      set({ authRuntimeMessage: status.message ?? null });
    },

    async createInstance(input) {
      const clean: CreateInstanceInput = {
        name: input.name.trim(),
        mcVersion: input.mcVersion.trim(),
        loader: input.loader,
        modpackName: input.modpackName?.trim() || null,
      };
      if (!clean.name || !clean.mcVersion) return;

      const native = await createInstanceNative(clean);
      const parsed = native ? instanceSchema.safeParse(native) : null;
      const instance = parsed?.success ? parsed.data : makeLocalInstance(clean);

      commit((draft) => {
        draft.instances.unshift(instance);
      });
    },

    async updateGlobalDefaults(config) {
      const parsed = launcherConfigSchema.safeParse(config);
      if (!parsed.success) {
        return { ok: false, error: "Invalid global defaults", issues: formatZodIssues(parsed.error.issues) };
      }
      commit((draft) => {
        draft.settingsSnapshots.unshift(
          createSettingsSnapshot({
            scope: "globalDefaults",
            note: "Global defaults updated",
            globalDefaults: draft.globalDefaults,
          }),
        );
        clamp(draft.settingsSnapshots, 80);
        draft.globalDefaults = parsed.data;
      });
      return { ok: true };
    },

    async savePresetPatch(presetId, patch, note = "Preset patch updated") {
      const parsed = launcherConfigPatchSchema.safeParse(patch);
      if (!parsed.success) {
        return { ok: false, error: "Invalid preset patch", issues: formatZodIssues(parsed.error.issues) };
      }
      let found = false;
      commit((draft) => {
        const preset = draft.presets.find((p) => p.id === presetId);
        if (!preset) return;
        found = true;
        draft.settingsSnapshots.unshift(
          createSettingsSnapshot({
            scope: "preset",
            note,
            presetId,
            presetPatch: preset.configPatch,
          }),
        );
        clamp(draft.settingsSnapshots, 80);
        preset.configPatch = parsed.data;
        preset.updatedAt = nowIso();
      });
      if (!found) return { ok: false, error: "Preset not found" };
      return { ok: true };
    },

    async rollbackSettingsSnapshot(snapshotId) {
      let applied = false;
      commit((draft) => {
        const snap = draft.settingsSnapshots.find((s) => s.id === snapshotId);
        if (!snap) return;
        if (snap.scope === "globalDefaults" && snap.globalDefaults) {
          draft.globalDefaults = snap.globalDefaults;
          applied = true;
          return;
        }
        if (snap.scope === "preset" && snap.presetId && snap.presetPatch) {
          const preset = draft.presets.find((p) => p.id === snap.presetId);
          if (!preset) return;
          preset.configPatch = snap.presetPatch;
          preset.updatedAt = nowIso();
          applied = true;
          return;
        }
        if (snap.scope === "ui" && snap.uiLanguage) {
          draft.ui.language = snap.uiLanguage;
          applied = true;
        }
      });
      if (!applied) return { ok: false, error: "Settings snapshot not found or not applicable" };
      return { ok: true };
    },

    async setLanguage(language) {
      commit((draft) => {
        if (draft.ui.language === language) return;
        draft.settingsSnapshots.unshift(
          createSettingsSnapshot({
            scope: "ui",
            note: "UI language changed",
            uiLanguage: draft.ui.language,
          }),
        );
        clamp(draft.settingsSnapshots, 80);
        draft.ui.language = language;
      });
    },

    async duplicateInstance(instanceId) {
      commit((draft) => {
        const source = draft.instances.find((instance) => instance.id === instanceId);
        if (!source) return;

        const now = nowIso();
        const copy = instanceSchema.parse({
          ...structuredClone(source),
          id: safeRandomId("inst"),
          name: duplicateName(
            source.name,
            draft.instances.map((instance) => instance.name),
          ),
          createdAt: now,
          updatedAt: now,
          lastPlayedAt: null,
        });

        draft.instances.unshift(copy);
      });
    },

    async deleteInstance(instanceId) {
      commit((draft) => {
        draft.instances = draft.instances.filter((instance) => instance.id !== instanceId);
      });
    },

    async applyPresetToInstance(instanceId, presetId) {
      let ok = false;
      commit((draft) => {
        const instance = draft.instances.find((i) => i.id === instanceId);
        if (!instance) return;
        instance.presetId = presetId;
        instance.updatedAt = nowIso();
        instance.snapshots.unshift(buildInstanceSnapshot(draft, instance, "Preset applied/changed"));
        clamp(instance.snapshots, 100);
        ok = true;
      });
      if (!ok) return { ok: false, error: "Instance not found" };
      return { ok: true };
    },

    async saveInstanceResolvedConfig(instanceId, config, note = "Config Studio save") {
      const parsed = launcherConfigSchema.safeParse(config);
      if (!parsed.success) {
        return { ok: false, error: "Invalid instance config", issues: formatZodIssues(parsed.error.issues) };
      }
      let found = false;
      commit((draft) => {
        const instance = draft.instances.find((i) => i.id === instanceId);
        if (!instance) return;
        const preset = instance.presetId ? draft.presets.find((p) => p.id === instance.presetId) ?? null : null;
        const base = resolveInstanceConfig({ ...draft, presets: preset ? [preset, ...draft.presets.filter((p) => p.id !== preset.id)] : draft.presets }, { ...instance, overrides: {} });
        instance.overrides = diffLauncherConfig(base, parsed.data);
        instance.updatedAt = nowIso();
        instance.snapshots.unshift(buildInstanceSnapshot(draft, instance, note));
        clamp(instance.snapshots, 100);
        found = true;
      });
      if (!found) return { ok: false, error: "Instance not found" };
      return { ok: true };
    },

    async rollbackInstanceSnapshot(instanceId, snapshotId) {
      let ok = false;
      commit((draft) => {
        const instance = draft.instances.find((i) => i.id === instanceId);
        if (!instance) return;
        const snap = instance.snapshots.find((s) => s.id === snapshotId);
        if (!snap) return;
        instance.presetId = snap.presetId;
        instance.overrides = structuredClone(snap.overrides);
        instance.updatedAt = nowIso();
        instance.snapshots.unshift(buildInstanceSnapshot(draft, instance, `Rollback to ${snapshotId}`));
        clamp(instance.snapshots, 100);
        ok = true;
      });
      if (!ok) return { ok: false, error: "Snapshot not found" };
      return { ok: true };
    },

    exportPresetJson(presetId) {
      const preset = get().data.presets.find((p) => p.id === presetId);
      if (!preset) return null;
      return JSON.stringify({ schema: "vesper/preset/v1", exportedAt: nowIso(), preset }, null, 2);
    },

    async importPresetJson(jsonText) {
      try {
        const raw = JSON.parse(jsonText) as unknown;
        const candidate =
          raw && typeof raw === "object" && "preset" in (raw as Record<string, unknown>)
            ? (raw as { preset: unknown }).preset
            : raw;
        const parsed = presetSchema.safeParse(candidate);
        if (!parsed.success) {
          return { ok: false, error: "Invalid preset JSON", issues: formatZodIssues(parsed.error.issues) };
        }
        commit((draft) => {
          const idx = draft.presets.findIndex((p) => p.id === parsed.data.id);
          if (idx >= 0) {
            draft.settingsSnapshots.unshift(
              createSettingsSnapshot({
                scope: "preset",
                note: "Preset imported (replace)",
                presetId: parsed.data.id,
                presetPatch: draft.presets[idx].configPatch,
              }),
            );
            draft.presets[idx] = parsed.data;
          } else {
            draft.presets.unshift(parsed.data);
          }
          clamp(draft.settingsSnapshots, 80);
        });
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Failed to parse preset JSON" };
      }
    },

    exportInstanceResolvedConfigJson(instanceId) {
      const instance = get().data.instances.find((i) => i.id === instanceId);
      if (!instance) return null;
      const resolved = resolveInstanceConfig(get().data, instance);
      return JSON.stringify(
        { schema: "vesper/instance-config/v1", instanceId, exportedAt: nowIso(), resolvedConfig: resolved },
        null,
        2,
      );
    },

    async importInstanceResolvedConfigJson(instanceId, jsonText) {
      try {
        const raw = JSON.parse(jsonText) as unknown;
        const candidate =
          raw && typeof raw === "object" && "resolvedConfig" in (raw as Record<string, unknown>)
            ? (raw as { resolvedConfig: unknown }).resolvedConfig
            : raw;
        return await get().saveInstanceResolvedConfig(instanceId, candidate, "Imported instance config JSON");
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Failed to parse instance JSON" };
      }
    },

    async launchInstance(instanceId) {
      try {
        const preview = await launchInstanceNative(instanceId);
        commit((draft) => {
          const instance = draft.instances.find((item) => item.id === instanceId);
          if (!instance) return;
          const now = nowIso();
          instance.lastPlayedAt = now;
          instance.updatedAt = now;
        });
        set({ lastLaunchPreview: preview });
        return preview;
      } catch (error) {
        set({ error: error instanceof Error ? error.message : String(error) });
        return null;
      }
    },
  };
});
