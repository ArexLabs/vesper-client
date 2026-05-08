# Frontend Guide

## Component Conventions

- Components use `PascalCase`, files use `kebab-case`
- UI primitives live in `src/components/ui/`
- Feature components are organized by domain (`discover/`, `instances/`, etc.)
- Each component file exports a single named function component

## State Management

### Zustand (src/store/)

Two stores:

- **`launcher-store.ts`**: Main application state (~582 lines). Uses a `commit()` pattern for immutable updates with Zod validation.

```typescript
function commit(mutator: (draft: AppState) => void) {
  const draft = structuredClone(get().data);
  mutator(draft);
  const parsed = appStateSchema.parse(draft);
  set({ data: parsed });
  void persist(parsed);
  return parsed;
}
```

- **`auth.ts`**: Simple auth state (logged in/out, username).

State is persisted via `saveAppStateToRuntime()` (Tauri invoke -> file, with localStorage fallback).

### Schema Validation

All external data is validated with Zod schemas in `src/lib/schemas.ts`. The `appStateSchema` serves as the single source of truth for application state shape.

## Routing

Uses `react-router-dom` v6 with the router configured in `src/router.tsx`. Route components live in `src/routes/`.

## API Client Layer (`src/lib/`)

### Modrinth API (`modrinth.ts`)

Uses `@modrinth/api-client` (`GenericModrinthClient`) for all Modrinth API interactions:

```typescript
import { modrinthClient, searchModrinthProjects } from "@/lib/modrinth";

// Search mods
const results = await searchModrinthProjects({
  query: "sodium",
  loader: "fabric",
  gameVersion: "1.20.1",
  sort: "downloads",
});

// Direct access to the client for advanced usage
modrinthClient.labrinth.projects_v2.get("sodium");
modrinthClient.labrinth.versions_v3.getProjectVersions("sodium", {
  game_versions: ["1.20.1"],
  loaders: ["fabric"],
});
```

### IPC/Tauri Bridge (`ipc.ts`)

All Tauri operations follow the `try-invoke-fallback` pattern:

```typescript
export async function someOperation(): Promise<Result> {
  try {
    return await invokeOrThrow<Result>("tauri_command", { args });
  } catch {
    // Web-compatible fallback
  }
}
```

### Minecraft Catalog (`minecraft-catalog.ts`)

Fetches:
- Minecraft versions from Mojang's launcher meta
- Loader tags from Modrinth API (via `@modrinth/api-client`)

Both are cached in memory after first fetch.

## Custom Hooks (`src/hooks/`)

- `use-modrinth-search.ts` — Wraps Modrinth search and install operations with loading/error state
- `use-mobile.ts` — Mobile viewport detection

## Styling

- Tailwind CSS utility classes
- shadcn/ui for accessible primitives
- CSS custom properties for theming (dark theme anchored on `#1C1F24` and `#141517`)
- Accent color: `#ffcea7`
- Rounded corners and squircles used throughout
