import { type AppState, type LauncherConfig, type Preset, appStateSchema } from "@/lib/schemas";

const now = "2026-02-26T18:00:00.000Z";

export const defaultGlobalConfig: LauncherConfig = {
  javaPath: "java",
  memoryMbMin: 2048,
  memoryMbMax: 4096,
  jvmArgs: ["-XX:+UseG1GC", "-XX:+UnlockExperimentalVMOptions"],
  rendererFlags: [],
  launchArgs: [],
  window: { width: 1280, height: 800, fullscreen: false },
  globalVersionFilter: null,
};

export const builtinPresets: Preset[] = [
  {
    id: "preset-performance",
    name: "Performance",
    description: "Balanced FPS with conservative visuals and stable JVM flags.",
    builtin: true,
    configPatch: {
      memoryMbMin: 2048,
      memoryMbMax: 4096,
      jvmArgs: ["-XX:+UseG1GC", "-XX:MaxGCPauseMillis=80"],
      rendererFlags: ["--fast-render"],
    },
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "preset-vanilla-clean",
    name: "Vanilla-Clean",
    description: "Minimal tweaks for a near-stock experience.",
    builtin: true,
    configPatch: {
      memoryMbMin: 1536,
      memoryMbMax: 3072,
      jvmArgs: ["-XX:+UseG1GC"],
      rendererFlags: [],
      launchArgs: [],
    },
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "preset-modded-heavy",
    name: "Modded-Heavy",
    description: "Higher memory budget and safer defaults for large packs.",
    builtin: true,
    configPatch: {
      memoryMbMin: 4096,
      memoryMbMax: 8192,
      rendererFlags: ["--defer-upload"],
      jvmArgs: ["-XX:+UseG1GC", "-XX:G1ReservePercent=20"],
    },
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "preset-shader-ready",
    name: "Shader-Ready",
    description: "Window and memory defaults tuned for shader-heavy sessions.",
    builtin: true,
    configPatch: {
      memoryMbMin: 4096,
      memoryMbMax: 6144,
      rendererFlags: ["--shader-cache-prewarm"],
      window: { width: 1600, height: 900, fullscreen: false },
    },
    createdAt: now,
    updatedAt: now,
  },
];

export function makeDefaultState(): AppState {
  return appStateSchema.parse({
    version: 1,
    globalDefaults: defaultGlobalConfig,
    presets: builtinPresets,
    instances: [],
    profiles: [
      {
        id: "profile-offline-default",
        provider: "offline",
        displayName: "Not Logged In",
        offlineUsername: null,
        authState: "signed_out",
      },
    ],
    ui: { language: "en" },
    settingsSnapshots: [],
  });
}
