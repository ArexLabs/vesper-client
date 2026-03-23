import { z } from "zod";

export const languageSchema = z.enum(["en", "de"]);
export const loaderSchema = z.enum(["vanilla", "fabric", "forge", "neoforge", "quilt"]);

const launcherConfigBaseSchema = z.object({
  javaPath: z.string().min(1).max(2048),
  memoryMbMin: z.number().int().min(256).max(65536),
  memoryMbMax: z.number().int().min(512).max(131072),
  jvmArgs: z.array(z.string().min(1)).max(128),
  rendererFlags: z.array(z.string()).max(64),
  launchArgs: z.array(z.string()).max(128),
  window: z.object({
    width: z.number().int().min(640).max(7680),
    height: z.number().int().min(360).max(4320),
    fullscreen: z.boolean(),
  }),
  globalVersionFilter: z.string().nullable().default(null),
});

export const launcherConfigSchema = launcherConfigBaseSchema.refine(
  (cfg) => cfg.memoryMbMax >= cfg.memoryMbMin,
  {
    path: ["memoryMbMax"],
    message: "memoryMbMax must be >= memoryMbMin",
  },
);

export const launcherConfigPatchSchema = launcherConfigBaseSchema.deepPartial().refine(
  (cfg) => {
    if (cfg.memoryMbMin === undefined || cfg.memoryMbMax === undefined) return true;
    return cfg.memoryMbMax >= cfg.memoryMbMin;
  },
  {
    path: ["memoryMbMax"],
    message: "Patch memoryMbMax must be >= memoryMbMin when both are set",
  },
);

export const presetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  builtin: z.boolean(),
  configPatch: launcherConfigPatchSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const instanceSnapshotSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string(),
  note: z.string().min(1),
  presetId: z.string().nullable(),
  overrides: launcherConfigPatchSchema,
  resolvedConfig: launcherConfigSchema,
});

export const instanceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  mcVersion: z.string().min(1),
  loader: loaderSchema,
  modpackName: z.string().nullable(),
  tags: z.array(z.string()),
  notes: z.string(),
  presetId: z.string().nullable(),
  overrides: launcherConfigPatchSchema,
  snapshots: z.array(instanceSnapshotSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastPlayedAt: z.string().nullable(),
});

export const settingsSnapshotSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  scope: z.enum(["globalDefaults", "preset", "ui"]),
  presetId: z.string().nullable(),
  note: z.string(),
  globalDefaults: launcherConfigSchema.nullable(),
  presetPatch: launcherConfigPatchSchema.nullable(),
  uiLanguage: languageSchema.nullable(),
});

export const profileSchema = z.object({
  id: z.string(),
  provider: z.enum(["offline", "microsoft"]),
  displayName: z.string(),
  minecraftUuid: z.string().nullable(),
  minecraftUsername: z.string().nullable(),
  offlineUsername: z.string().nullable(),
  authState: z.enum(["signed_out", "signed_in", "expired"]),
});

export const userSessionSchema = z.object({
  profileId: z.string(),
  microsoftAccessToken: z.string(),
  microsoftRefreshToken: z.string().nullable(),
  xboxToken: z.string().nullable(),
  xstsToken: z.string().nullable(),
  minecraftAccessToken: z.string().nullable(),
  expiresAt: z.number(), // timestamp
});

export const uiSettingsSchema = z.object({
  language: languageSchema,
});

export const appStateSchema = z.object({
  version: z.literal(1),
  globalDefaults: launcherConfigSchema,
  presets: z.array(presetSchema),
  instances: z.array(instanceSchema),
  profiles: z.array(profileSchema),
  ui: uiSettingsSchema,
  settingsSnapshots: z.array(settingsSnapshotSchema),
});

export type Language = z.infer<typeof languageSchema>;
export type Loader = z.infer<typeof loaderSchema>;
export type LauncherConfig = z.infer<typeof launcherConfigSchema>;
export type LauncherConfigPatch = z.infer<typeof launcherConfigPatchSchema>;
export type Preset = z.infer<typeof presetSchema>;
export type InstanceSnapshot = z.infer<typeof instanceSnapshotSchema>;
export type Instance = z.infer<typeof instanceSchema>;
export type SettingsSnapshot = z.infer<typeof settingsSnapshotSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type UserSession = z.infer<typeof userSessionSchema>;
export type AppState = z.infer<typeof appStateSchema>;

export function formatZodIssues(issues: z.ZodIssue[]) {
  return issues.map((issue) => {
    const path = issue.path.length ? issue.path.join(".") : "(root)";
    return `${path}: ${issue.message}`;
  });
}
