import {
  type AppState,
  type Instance,
  type InstanceSnapshot,
  type LauncherConfig,
  type LauncherConfigPatch,
  launcherConfigSchema,
} from "@/lib/schemas";
import { safeRandomId } from "@/lib/utils";

function sameArray(a: string[], b: string[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function mergeLauncherConfig(
  base: LauncherConfig,
  ...patches: Array<LauncherConfigPatch | null | undefined>
): LauncherConfig {
  const out: LauncherConfig = structuredClone(base);
  for (const patch of patches) {
    if (!patch) continue;
    if (patch.javaPath !== undefined) out.javaPath = patch.javaPath;
    if (patch.memoryMbMin !== undefined) out.memoryMbMin = patch.memoryMbMin;
    if (patch.memoryMbMax !== undefined) out.memoryMbMax = patch.memoryMbMax;
    if (patch.jvmArgs !== undefined) out.jvmArgs = [...patch.jvmArgs];
    if (patch.rendererFlags !== undefined) out.rendererFlags = [...patch.rendererFlags];
    if (patch.launchArgs !== undefined) out.launchArgs = [...patch.launchArgs];
    if (patch.window) out.window = { ...out.window, ...patch.window };
  }
  return launcherConfigSchema.parse(out);
}

export function diffLauncherConfig(base: LauncherConfig, next: LauncherConfig): LauncherConfigPatch {
  const patch: LauncherConfigPatch = {};
  if (base.javaPath !== next.javaPath) patch.javaPath = next.javaPath;
  if (base.memoryMbMin !== next.memoryMbMin) patch.memoryMbMin = next.memoryMbMin;
  if (base.memoryMbMax !== next.memoryMbMax) patch.memoryMbMax = next.memoryMbMax;
  if (!sameArray(base.jvmArgs, next.jvmArgs)) patch.jvmArgs = [...next.jvmArgs];
  if (!sameArray(base.rendererFlags, next.rendererFlags)) patch.rendererFlags = [...next.rendererFlags];
  if (!sameArray(base.launchArgs, next.launchArgs)) patch.launchArgs = [...next.launchArgs];
  const windowPatch: NonNullable<LauncherConfigPatch["window"]> = {};
  if (base.window.width !== next.window.width) windowPatch.width = next.window.width;
  if (base.window.height !== next.window.height) windowPatch.height = next.window.height;
  if (base.window.fullscreen !== next.window.fullscreen) {
    windowPatch.fullscreen = next.window.fullscreen;
  }
  if (Object.keys(windowPatch).length) patch.window = windowPatch;
  return patch;
}

export function resolveInstanceConfig(state: AppState, instance: Instance): LauncherConfig {
  const preset = instance.presetId ? state.presets.find((p) => p.id === instance.presetId) ?? null : null;
  return mergeLauncherConfig(state.globalDefaults, preset?.configPatch, instance.overrides);
}

export function buildInstanceSnapshot(state: AppState, instance: Instance, note: string): InstanceSnapshot {
  return {
    id: safeRandomId("snap"),
    createdAt: new Date().toISOString(),
    note,
    presetId: instance.presetId,
    overrides: structuredClone(instance.overrides),
    resolvedConfig: resolveInstanceConfig(state, instance),
  };
}

export function argsToMultiline(values: string[]) {
  return values.join("\n");
}

export function multilineToArgs(value: string) {
  return value
    .split(/\r?\n/g)
    .map((x) => x.trim())
    .filter(Boolean);
}
