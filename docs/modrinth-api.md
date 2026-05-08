# Modrinth API Integration

## Client

The app uses the official `@modrinth/api-client` package (v0.1.0+) for all Modrinth API interactions. A single shared `GenericModrinthClient` instance is created in `src/lib/modrinth.ts` and reused across the app.

```typescript
import { modrinthClient } from "@/lib/modrinth";
```

## Module Structure

The client exposes a nested module structure matching the API:

| Module | Endpoint | Purpose |
|---|---|---|
| `client.labrinth.projects_v2` | `/v2/project` | Project CRUD, search, gallery |
| `client.labrinth.projects_v3` | `/v3/project` | Project with organization support |
| `client.labrinth.versions_v2` | `/v2/version` | Version retrieval |
| `client.labrinth.versions_v3` | `/v3/version` | Version CRUD with file uploads |
| `client.labrinth.tags_v2` | `/v2/tag` | License text retrieval |
| `client.labrinth.state` | `/v2/state` | Aggregated state (loaders, categories, game versions) |

### Direct Requests

For endpoints not covered by modules, use `client.request()`:

```typescript
const loaders = await modrinthClient.request<{ name: string }[]>("/tag/loader", {
  api: "labrinth",
  version: 2,
});
```

## Search

Search is done via `client.labrinth.projects_v2.search()`:

```typescript
const result = await modrinthClient.labrinth.projects_v2.search({
  query: "sodium",
  facets: [["project_type:mod"], ["categories:fabric"]],
  index: "downloads",
  limit: 20,
});
```

The app wraps this in `searchModrinthProjects()` (`src/lib/modrinth.ts`) with facet building and result mapping.

### Facets

Facets filter search results. The app builds facets for:
- `project_type:mod` — Always applied to restrict to mods
- `categories:<loader>` — Applied when a specific loader is selected
- `versions:<game_version>` — Applied when a specific game version is selected

## Version Resolution

For getting project versions:

```typescript
const versions = await modrinthClient.labrinth.versions_v3.getProjectVersions("sodium", {
  game_versions: ["1.20.1"],
  loaders: ["fabric"],
});
```

## Tag/Loader Data

Loader options are fetched via the `/tag/loader` endpoint. The Rust backend also calls the Modrinth API directly for Sodium version resolution in `src-tauri/src/services/mod_resolver.rs`.

## Caveats

- `@modrinth/api-client` is a WIP and the API may change. Check the [package README](https://www.npmjs.com/package/@modrinth/api-client) for updates.
- Not all API endpoints are covered by modules yet — use `client.request()` for unsupported endpoints.
- The client uses `ofetch` internally and works in all environments (browser, Node.js, Tauri).
