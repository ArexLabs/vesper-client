# Vesper Client Code Review

Review date: 2026-05-16  
Scope: full provided repository (`src/`, `src-tauri/`, configuration, tests, and project tooling).  
Mode: strict code review. This document prioritizes production-readiness issues and cites exact files/lines for each finding.

## Executive Summary

The repository has a promising separation between a React/Vite frontend and a Tauri/Rust backend, with Zod schemas providing a useful frontend domain model and a small Rust service layer for instance creation and Modrinth integration. However, the current codebase is not production-ready. The most severe problems are integration breakages between frontend IPC contracts and registered Tauri commands, TypeScript compile failures, incomplete Microsoft authentication, unimplemented persistence/launch/discover native commands referenced by the UI, unsafe filesystem handling for instance creation, and a downloader that does not validate downloaded artifacts.

The highest-priority remediation is to restore a single typed contract between frontend and Rust commands, make the project pass `bun run typecheck`, and add integration tests around all IPC boundaries before expanding feature work.

## Validation Snapshot

| Check | Result | Notes |
| --- | --- | --- |
| `bun run typecheck` | Fails | Multiple TS errors around unsupported `Button asChild`, unsupported `Badge` variants, React DayPicker class names, and `noUncheckedIndexedAccess` issues. |
| `bun run test:run` | Passes | Only one unit test file is present, covering a narrow config helper path. |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Blocked by environment | The container is missing `glib-2.0.pc`, so Rust semantic errors behind that system dependency could not be reached. |

## Priority Legend

- **P0 / Critical:** Blocks build, app startup, login, data integrity, or creates clear security exposure.
- **P1 / High:** Likely production defect, security hardening gap, scalability limitation, or major correctness risk.
- **P2 / Medium:** Maintainability, testability, consistency, UX resilience, or performance issue that will compound.
- **P3 / Low:** Cleanup and polish issues.

---

## P0 Findings

### 1. Rust command registration references a non-existent `microsoft_login` command

**Evidence**

- `src-tauri/src/lib.rs` imports `commands::auth::microsoft_login`, but `auth.rs` defines `auth_get_status`, `auth_begin_microsoft_device_login`, `auth_poll_microsoft_device_login`, and `auth_logout_microsoft`; it does not define `microsoft_login`. (`src-tauri/src/lib.rs:7`, `src-tauri/src/commands/auth.rs:73`, `src-tauri/src/commands/auth.rs:94`, `src-tauri/src/commands/auth.rs:146`, `src-tauri/src/commands/auth.rs:274`)
- The invoke handler registers only `create_instance` and `microsoft_login`, so even the real auth functions are not exposed. (`src-tauri/src/lib.rs:13-15`)
- The frontend invokes `auth_get_status`, `auth_begin_microsoft_device_login`, `auth_poll_microsoft_device_login`, and `auth_logout_microsoft`. (`src/lib/ipc.ts:170-188`)

**Risk**

Critical build and runtime integration failure. The Tauri backend cannot compile as written once Rust reaches semantic checking, and the frontend auth flow cannot call the commands it expects.

**Recommended remediation**

- Replace `microsoft_login` registration with all implemented auth commands.
- Add `.manage(AuthState { sessions: Mutex::new(HashMap::new()) })` during builder setup because the auth commands require `State<'_, AuthState>`.
- Add a Rust compile test/CI job that reaches application code, plus an IPC smoke test that asserts every frontend command string is registered by the backend.

---

### 2. Frontend and backend disagree on the `create_instance` IPC shape

**Evidence**

- The Rust command expects four top-level parameters: `name`, `game_version`, `loader`, and `include_sodium`. (`src-tauri/src/commands/instance.rs:5-11`)
- The frontend sends a single `input` object to the command. (`src/lib/ipc.ts:132-135`)
- The frontend model calls the version field `mcVersion`, not `game_version`. (`src/lib/ipc.ts:7-12`)
- The store parses a native response as an `Instance`, but the Rust command returns `Result<(), String>`, causing the frontend to always fall back to a local instance. (`src/store/launcher-store.ts:277-279`, `src-tauri/src/commands/instance.rs:30`)

**Risk**

Critical feature breakage. Native instance creation receives malformed arguments, native metadata is never returned, and errors are silently swallowed by the frontend fallback path.

**Recommended remediation**

- Define a shared DTO: either `CreateInstanceInput { name, mcVersion/gameVersion, loader, includeSodium, modpackName }` with Serde rename rules, or make the frontend send the exact Rust arguments.
- Return a complete `Instance` payload from Rust or explicitly model the command as side-effect-only and stop parsing it as an `Instance`.
- Fail visibly on native command failures in desktop mode; only fall back in browser development mode.

---

### 3. Many frontend IPC calls reference native commands that are not implemented or registered

**Evidence**

- Frontend persistence calls `load_app_state` and `save_app_state`, but the Rust invoke handler registers neither. (`src/lib/ipc.ts:91-114`, `src-tauri/src/lib.rs:13-15`)
- The diagnostics page probes `list_instances` and secure storage placeholders. (`src/routes/diagnostics-page.tsx:35-50`)
- The frontend calls `launch_instance`, `discover_search_modrinth`, and `discover_download_modrinth`. (`src/lib/ipc.ts:117-148`, `src/lib/ipc.ts:218-248`)
- The Rust backend only registers `create_instance` and the missing `microsoft_login`. (`src-tauri/src/lib.rs:13-15`)

**Risk**

Critical architectural drift. The UI presents desktop-native capabilities that are not available. Because many wrappers catch errors and fall back, production defects can remain hidden until data loss, failed installs, or failed launches occur.

**Recommended remediation**

- Maintain an explicit `commands` contract file documenting every command, argument shape, return type, and fallback policy.
- Implement or remove each command path before shipping UI affordances.
- Add tests that mock Tauri `invoke` and assert command names/arguments for each store action.

---

### 4. TypeScript does not compile under the repository's strict configuration

**Evidence**

- `Button` is a Base UI wrapper that accepts `render`, not shadcn-style `asChild`. (`src/components/ui/button.tsx:43-55`)
- Multiple routes use `Button asChild`, including Config Studio and the active Instances route. (`src/routes/config-studio-page.tsx:99-101`, `src/routes/config-studio-page.tsx:242-244`, `src/routes/instances/InstancesPage.tsx:254-256`)
- `Badge` variants only include `default`, `secondary`, `destructive`, `outline`, `ghost`, and `link`; call sites use unsupported variants such as `accent` and `muted`. (`src/components/ui/badge.tsx:10-27`, `src/components/app-layout.tsx:78-86`, `src/routes/instances-page.tsx:260`)
- React DayPicker class names include a `table` key that is not part of the installed type's `ClassNames` surface. (`src/components/ui/calendar.tsx:88`)
- The store mutates array-indexed entries without narrowing under `noUncheckedIndexedAccess`. (`src/store/launcher-store.ts:169-179`, `src/store/launcher-store.ts:502-514`, `tsconfig.json:20-23`)

**Risk**

Critical build failure. The code cannot be confidently built, refactored, or type-checked, and CI will reject normal PRs.

**Recommended remediation**

- Convert `asChild` call sites to Base UI's `render` API or extend `Button` with an explicit compatibility prop.
- Add `accent`/`muted` variants intentionally to `Badge` or replace call sites with supported variants.
- Align `calendar.tsx` with the exact installed `react-day-picker` API.
- Fix indexed mutations by assigning narrowed locals before mutation.
- Keep `bun run typecheck` as a required pre-merge gate.

---

### 5. The Tauri auth state required by auth commands is never managed

**Evidence**

- Auth commands require `State<'_, AuthState>`. (`src-tauri/src/commands/auth.rs:73-76`, `src-tauri/src/commands/auth.rs:94-97`, `src-tauri/src/commands/auth.rs:146-150`)
- `AuthState` owns the device-flow session map. (`src-tauri/src/commands/auth.rs:13-15`)
- The Tauri builder does not call `.manage(...)`. (`src-tauri/src/lib.rs:13-15`)

**Risk**

Critical runtime failure. Even after registering the commands, Tauri will reject invocations that request unmanaged state.

**Recommended remediation**

Initialize `AuthState` in `run()` and add a focused test or debug command that verifies state-backed commands can be invoked successfully.

---

## P1 Findings

### 6. Microsoft authentication is incomplete and does not produce Minecraft credentials

**Evidence**

- The OAuth scope only requests `XboxLive.signin offline_access`. (`src-tauri/src/commands/auth.rs:100-103`)
- On success, the code reads the Microsoft `access_token` and calls Microsoft Graph `/me`. (`src-tauri/src/commands/auth.rs:182-190`, `src-tauri/src/commands/auth.rs:254-260`)
- The profile returned to the frontend is a synthetic `microsoft-profile` with only display name and auth state; no Minecraft access token, XBL/XSTS token, entitlements, or selected Minecraft profile are produced. (`src-tauri/src/commands/auth.rs:197-203`)
- Secure storage utilities exist, but the auth flow never writes refresh tokens or credentials to them. (`src-tauri/src/secure_storage.rs:18-38`, `src-tauri/src/commands/auth.rs:182-210`)

**Risk**

High correctness and security risk. The launcher can mark users as signed in without having valid Minecraft credentials, entitlement checks, refresh-token persistence, or token-expiry handling.

**Recommended remediation**

Implement the complete Minecraft auth chain: Microsoft device code -> Microsoft token -> Xbox Live auth -> XSTS -> Minecraft services login -> entitlement/profile lookup. Store refresh tokens in OS keychain, persist expiry metadata, and expose typed auth states (`signed_in`, `expired`, `needs_reauth`) rather than synthetic placeholders.

---

### 7. Instance creation allows path traversal and unsafe filesystem names

**Evidence**

- The backend joins the raw user-controlled `name` into the instance path. (`src-tauri/src/commands/instance.rs:12-15`)
- Frontend validation only requires a non-empty trimmed name; it does not reject path separators, `..`, reserved names, or shell-sensitive characters. (`src/components/instances/CreateInstanceSheet.tsx:19-28`, `src/components/instances/CreateInstanceSheet.tsx:149-161`)

**Risk**

High security/data-integrity risk. A malicious or accidental instance name such as `../other-directory` could create or modify directories outside the intended instance root.

**Recommended remediation**

- Introduce a slug or UUID-based storage directory independent of display name.
- Validate names on both frontend and backend.
- Canonicalize the target path and verify it remains under the launcher instances root before writing.

---

### 8. Downloader loads entire files into memory and does not verify downloaded artifacts

**Evidence**

- `Downloader::download` calls `response.bytes().await?` and writes the entire body at once. (`src-tauri/src/services/downloader.rs:35-37`)
- The Modrinth file model stores only `url`, `filename`, and `primary`; it omits hashes and size metadata. (`src-tauri/src/models/modrinth.rs:3-8`)
- The downloader derives the destination filename from URL path segments instead of the API-provided filename. (`src-tauri/src/services/downloader.rs:15-20`)

**Risk**

High performance and supply-chain risk. Large downloads can spike memory usage, partially written files can masquerade as complete downloads, and unverified mod jars can be corrupted or tampered with.

**Recommended remediation**

- Stream response chunks to a temporary file and atomically rename on success.
- Extend `ModrinthFile` with `hashes`, `size`, and `filename` from the Modrinth API.
- Verify SHA-512/SHA-1 hashes and expected size before install.
- Refuse non-HTTPS URLs and normalize/sanitize filenames.

---

### 9. Native command errors are broadly swallowed, hiding production failures

**Evidence**

- App-state load/save catches all errors and falls back to `localStorage`. (`src/lib/ipc.ts:91-114`)
- `createInstanceNative` catches all errors and returns `null`. (`src/lib/ipc.ts:132-138`)
- `launchInstanceNative` catches all errors and returns a fake local preview. (`src/lib/ipc.ts:140-150`)
- Store creation treats a missing/invalid native response as success by creating a local instance. (`src/store/launcher-store.ts:277-283`)

**Risk**

High correctness and observability risk. Desktop-specific breakages can look successful to users while no native files, downloads, or launches occurred.

**Recommended remediation**

Distinguish web-development fallback from desktop runtime failure. If Tauri runtime exists, propagate command errors into typed user-visible failures and telemetry/logging; only use `localStorage` and preview fallbacks when no Tauri runtime is present.

---

### 10. Tauri development configuration enables devtools in the main dependency feature set

**Evidence**

- The Tauri dependency enables `devtools` unconditionally. (`src-tauri/Cargo.toml:11-13`)

**Risk**

High security hardening concern if production builds inherit development tooling. Devtools can expose internals, logs, and application state.

**Recommended remediation**

Gate devtools behind a development-only feature or `cfg(debug_assertions)`. Verify production packaging disables devtools and audit bundle permissions before release.

---

### 11. Tauri shell plugin is configured to allow opening URLs globally

**Evidence**

- `tauri.conf.json` enables shell plugin `open`. (`src-tauri/tauri.conf.json:32-36`)

**Risk**

High attack-surface concern if untrusted URLs can reach shell open calls. It is currently used conceptually for login/opening pages, but the allowlist is broad at configuration level.

**Recommended remediation**

Constrain URL opening to explicit commands that validate destination hosts (`login.microsoftonline.com`, `microsoft.com`, `modrinth.com`, etc.) and keep Tauri permissions as narrow as possible.

---

## P2 Findings

### 12. Architecture mixes durable domain state, runtime effects, and UI fallback policy in one Zustand store

**Evidence**

- `useLauncherStore` owns app data, persistence, auth synchronization, instance creation, config snapshots, import/export, and launch side effects in one module. (`src/store/launcher-store.ts:44-75`, `src/store/launcher-store.ts:146-182`, `src/store/launcher-store.ts:191-284`, `src/store/launcher-store.ts:564-580`)

**Risk**

Medium maintainability and testability risk. Cross-cutting responsibilities make it harder to test domain logic without runtime mocks and increase the chance of accidental persistence or auth side effects during UI interactions.

**Recommended remediation**

Split into layers: pure domain reducers/helpers, a persistence repository, an auth service, an instance service, and thin Zustand actions that compose those services. Unit-test pure logic independently and integration-test service boundaries.

---

### 13. Config Studio recalculates JSON in an effect dependency and can overwrite user edits

**Evidence**

- The Config Studio effect depends on `JSON.stringify(resolved)` and resets the editor value whenever that serialized config changes. (`src/routes/config-studio-page.tsx:35-40`)

**Risk**

Medium UX/correctness risk. Any store update that changes the resolved config while the user is editing can overwrite unsaved edits. Serializing in dependencies is also inefficient for larger configs.

**Recommended remediation**

Track the selected instance/config revision separately, initialize drafts only on selection changes or explicit reset, and warn before discarding dirty editor state.

---

### 14. Importing Config Studio JSON immediately persists it, before explicit user confirmation

**Evidence**

- `onImport` reads a file, updates the editor text, and immediately calls `importInstanceResolvedConfigJson`, which saves a snapshot. (`src/routes/config-studio-page.tsx:77-88`)
- The UI describes a manual save workflow. (`src/routes/config-studio-page.tsx:235-241`)

**Risk**

Medium data integrity/UX risk. Users may expect importing to stage data for review, but the app persists it immediately.

**Recommended remediation**

Make import load data into the editor only. Require the existing Save action to persist changes, or present a confirmation dialog that clearly states a snapshot will be written.

---

### 15. The codebase contains duplicate Instances page implementations

**Evidence**

- Router imports the active page from `src/routes/instances/InstancesPage.tsx`. (`src/router.tsx:9-21`)
- A separate `src/routes/instances-page.tsx` exports another `InstancesPage`. (`src/routes/instances-page.tsx:15`)

**Risk**

Medium consistency and maintenance risk. Duplicate routes/components drift, create compile errors from unused legacy code, and confuse contributors about the canonical implementation.

**Recommended remediation**

Delete the unused implementation or consolidate shared pieces into components. Keep route files consistently kebab-case or directory-based, not both for the same route.

---

### 16. Search calls are not debounced and empty searches still hit Modrinth

**Evidence**

- The Modrinth search hook starts a request for every dependency change. (`src/hooks/use-modrinth-search.ts:24-54`)
- `searchModrinthProjects` trims the query but still calls the API even when the result is empty. (`src/lib/modrinth.ts:63-75`)

**Risk**

Medium performance and rate-limit risk. Typing in the search box can generate a request per keystroke, and initial empty queries can waste API quota.

**Recommended remediation**

Add a minimum query length, debounce input, cancel in-flight requests with `AbortController`, and cache recent results by query/loader/version/sort.

---

### 17. Backend HTTP clients lack timeouts and retry/error policy

**Evidence**

- Auth and Modrinth code create default `reqwest::Client` instances without configured timeouts. (`src-tauri/src/commands/auth.rs:98`, `src-tauri/src/commands/auth.rs:168`, `src-tauri/src/services/mod_resolver.rs:12-21`)
- Downloader uses `reqwest::get` directly without a reusable configured client. (`src-tauri/src/services/downloader.rs:28`)

**Risk**

Medium resilience risk. Network hangs can stall operations indefinitely, and the app has no consistent retry, backoff, or user-facing error classification.

**Recommended remediation**

Centralize HTTP clients with connect/request timeouts, user-agent, retry/backoff where appropriate, and structured error mapping.

---

### 18. Session lifecycle does not enforce server-side expiry or cleanup until polling errors

**Evidence**

- Device-flow sessions store `expires_in_seconds` but no creation timestamp or absolute expiry. (`src-tauri/src/commands/auth.rs:17-25`, `src-tauri/src/commands/auth.rs:122-133`)
- Polling removes sessions only on successful completion or `expired_token`. (`src-tauri/src/commands/auth.rs:192-195`, `src-tauri/src/commands/auth.rs:232-241`)

**Risk**

Medium memory/lifecycle risk. Stale sessions can remain indefinitely if polling stops, and server-provided expiration is not enforced locally.

**Recommended remediation**

Store `created_at`/`expires_at`, reject locally expired sessions, and periodically prune stale sessions. Consider limiting concurrent sessions per app/user.

---

### 19. Tests are too narrow for the amount of critical logic present

**Evidence**

- Only one Vitest file exists and it covers a single config merge/diff path. (`src/lib/config.test.ts:1-18`)
- The frontend store contains extensive persistence, auth, snapshot, import/export, and launch logic with no direct tests. (`src/store/launcher-store.ts:44-75`)
- Rust services/commands have no tests in the provided backend files. (`src-tauri/src/commands/instance.rs:5-31`, `src-tauri/src/services/downloader.rs:9-40`, `src-tauri/src/services/mod_resolver.rs:8-42`)

**Risk**

Medium regression risk. Most high-risk behavior is unprotected, especially IPC shape, filesystem safety, auth, and downloads.

**Recommended remediation**

Add unit tests for schema boundaries, store actions, config snapshots, import/export behavior, and IPC wrappers. Add Rust tests for path sanitization, DTO deserialization, Modrinth response parsing, and downloader verification with local test servers/mocks.

---

### 20. Global context-menu suppression hurts desktop usability and debugging

**Evidence**

- `main.tsx` disables the context menu for the entire document. (`src/main.tsx:9-12`)

**Risk**

Medium UX/accessibility risk. Users lose native copy/paste/debug actions in inputs and text areas, and developers lose useful inspection affordances.

**Recommended remediation**

Remove the global listener or scope it only to specific non-text interactive surfaces where a custom context menu is actually implemented.

---

## P3 Findings

### 21. Dependency and package-manager consistency needs cleanup

**Evidence**

- The repository includes `bun.lock`, `pnpm-lock.yaml`, and `package-lock.json`, while `package.json` declares `packageManager` as pnpm. (`package.json:75-80`)
- The scripts invoke npm-flavored commands internally even though repository instructions prefer Bun > pnpm > npm. (`package.json:6-19`)

**Risk**

Low-to-medium reproducibility risk. Multiple lockfiles and mixed package-manager conventions can cause dependency drift across contributors and CI.

**Recommended remediation**

Choose one package manager, keep one lockfile, and make scripts/packageManager/CI match that choice. If Bun is preferred, regenerate lockfiles and update CI accordingly; otherwise document pnpm as canonical.

---

### 22. Several Rust error variants appear unused or too coarse for actionable UX

**Evidence**

- `AppError` includes variants such as `InstanceCreation` and `AuthError`, while command code often maps errors directly to strings. (`src-tauri/src/error.rs:4-20`, `src-tauri/src/commands/instance.rs:12-15`, `src-tauri/src/commands/auth.rs:105-120`)

**Risk**

Low maintainability/observability risk. Stringly-typed errors are hard to localize, classify, log, or test.

**Recommended remediation**

Use typed error enums at command/service boundaries and serialize stable error codes plus safe messages to the frontend.

---

### 23. Modrinth integration exists in both frontend and backend with overlapping responsibilities

**Evidence**

- Frontend code directly searches Modrinth via `@modrinth/api-client`. (`src/lib/modrinth.ts:1-5`, `src/lib/modrinth.ts:63-75`)
- Backend code also resolves Modrinth Sodium versions. (`src-tauri/src/services/mod_resolver.rs:6-28`)
- Frontend IPC wrappers also reference native discover commands. (`src/lib/ipc.ts:218-248`)

**Risk**

Low-to-medium separation-of-concerns risk. API policy, caching, user-agent, validation, and install decisions can diverge between layers.

**Recommended remediation**

Decide whether Modrinth discovery is a frontend-only web API feature or a backend-mediated desktop service. For installs, prefer backend mediation so downloads, verification, filesystem writes, and permission checks are centralized.

---

## Suggested Remediation Roadmap

### Phase 1: Restore build and IPC integrity

1. Fix TypeScript errors and make `bun run typecheck` pass.
2. Register all implemented Tauri commands and manage required state.
3. Replace ad hoc command strings with typed DTOs shared by tests.
4. Make desktop-mode native failures visible instead of silently falling back.

### Phase 2: Secure filesystem, auth, and downloads

1. Introduce safe instance IDs/slugs and backend path canonicalization.
2. Complete the Minecraft auth chain and keychain-backed token storage.
3. Stream downloads, verify hashes/sizes, and atomically install files.
4. Harden Tauri devtools/shell permissions for production builds.

### Phase 3: Improve architecture and test coverage

1. Split store responsibilities into domain, persistence, auth, and instance service modules.
2. Remove duplicate route implementations and align component APIs.
3. Add frontend unit/integration tests around store actions and IPC wrappers.
4. Add Rust unit tests and mocked-network tests for command/service behavior.

### Phase 4: Performance and UX polish

1. Debounce/cancel Modrinth search and cache catalog data with TTLs.
2. Avoid serializing resolved config in React dependency arrays.
3. Remove global context-menu suppression or scope it narrowly.
4. Standardize package manager and lockfile policy.
