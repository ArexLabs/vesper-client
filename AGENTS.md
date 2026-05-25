# Repository Guidelines

## Project Structure & Module Organization
This repository is a Tauri v2 desktop app with a React/Vite frontend.

- `src/`: React + TypeScript UI code (`components/`, `routes/`, `lib/`, `store/`, `styles/`)
- `src/test/`: test setup (`vitest` + Testing Library matchers)
- `public/`: static assets (fonts are loaded from `public/fonts/`)
- `src-tauri/`: Rust backend (`src/`, `Cargo.toml`, `tauri.conf.json`)
- `.github/workflows/`: CI and release workflows

Use the `@/` alias for imports from `src` (configured in `tsconfig.json` and `vite.config.ts`).

## Build, Test, and Development Commands
- `npm install`: install frontend and Tauri CLI dependencies
- `npm run dev`: start the Vite dev server (web UI)
- `npm run tauri:dev`: run the desktop app in Tauri dev mode
- `npm run build`: build the frontend bundle
- `npm run tauri:build`: build the desktop app package
- `npm run lint`: run Biome checks
- `npm run format`: format code with Biome (2-space indentation)
- `npm run typecheck`: run TypeScript type checks
- `npm run test` / `npm run test:run`: run Vitest (watch / single run)
- `npm run codechecker`: run knip + cspell + lint + typecheck (full code quality pass)
- `cargo check --manifest-path src-tauri/Cargo.toml`: validate Rust backend changes

## Coding Style & Naming Conventions
- TypeScript/TSX uses Biome formatting: 2-space indentation, double quotes, trailing commas.
- Keep files and exports descriptive: `kebab-case` for route/component files (for example, `settings-page.tsx`), `camelCase` for variables/functions, `PascalCase` for React components and types.
- Prefer small utilities in `src/lib/` and colocate UI primitives under `src/components/ui/`.
- Theme palette defaults: use `#ffcea7` for accents (replace amber), with dark surfaces anchored on `#1C1F24` and `#141517`.

## Testing Guidelines
- Framework: `Vitest` with `jsdom`; test setup lives in `src/test/setup.ts`.
- Name tests `*.test.ts` (example: `src/lib/config.test.ts`).
- Add/adjust tests for config, schema, and utility logic when behavior changes.
- Before opening a PR, run: `npm run lint && npm run typecheck && npm run test:run && npm run build`.

## Commit & Pull Request Guidelines
This checkout has no commit history yet, so use a consistent convention going forward.

- Commit format: Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`).
- Keep commits focused (frontend UI, Rust backend, and tooling changes separate when practical).
- PRs should include: summary, testing performed, linked issue (if any), and screenshots/GIFs for UI changes.
- Ensure CI passes (`frontend` and `rust-check` jobs) before requesting review.

## Security & Configuration Tips
- Do not commit secrets, tokens, or local machine paths.
- Treat launcher/command execution changes as high risk; keep Tauri command surfaces explicit and minimal.

## Microsoft Authentication (Entra ID / OAuth 2.0)

### Architecture Decision
This app uses **OAuth 2.0 Device Code Flow** (Device Authorization Grant) for Microsoft login.
- Best for desktop apps: no redirect URI, no embedded browser, user authenticates in their default browser.
- All token exchange happens in Rust via `reqwest` — no OAuth secrets exposed in the webview.
- MSAL cannot be used in Tauri: MSAL Browser needs a web context, MSAL Node needs Node.js runtime.
- Custom OAuth 2.0 in Rust is the correct approach for Tauri v2.

### Azure Portal App Registration
1. Go to https://portal.azure.com -> Microsoft Entra ID -> App registrations -> New registration
2. **Name**: "Vesper Launcher"
3. **Supported account types**: "Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)"
4. **Redirect URI**: Leave empty (Device Code Flow does not use redirect URIs)
5. Register, copy the **Application (client) ID** to your config.
6. Under **Authentication** -> **Advanced settings**: Set "Allow public client flows" to **Yes**
7. Under **API permissions**: No additional permissions needed for `XboxLive.signin`, but if you need Graph API, add `User.Read` (delegated).

### How to Set the Client ID
**Production**: Set env var when building:
```bash
VESPER_AZURE_CLIENT_ID="your-client-id-here" npm run tauri:build
```

**Development**: The code falls back to a placeholder — set the env var:
```bash
VESPER_AZURE_CLIENT_ID="your-client-id-here" npm run tauri:dev
```

### Code Architecture
| Layer | File | Role |
|-------|------|------|
| **Rust config** | `src-tauri/src/entra_config.rs` | Client ID, authority URL, scopes |
| **Rust auth commands** | `src-tauri/src/commands/auth.rs` | Device code, token poll, refresh, logout |
| **Rust secure storage** | `src-tauri/src/secure_storage.rs` | OS keyring (Credential Manager / Keychain / libsecret) |
| **Frontend IPC** | `src/lib/ipc.ts` | Typed Tauri invoke wrappers |
| **Frontend store** | `src/store/auth.ts` | React state for auth flow |
| **Frontend launcher store** | `src/store/launcher-store.ts` | Higher-level auth orchestration |

### Endpoints Used
- **Authority**: `https://login.microsoftonline.com/common` (routes to MSA or org tenant)
- **Device Code**: `{authority}/oauth2/v2.0/devicecode`
- **Token**: `{authority}/oauth2/v2.0/token`
- **Revoke**: `{authority}/oauth2/v2.0/revoke`
- **Graph**: `https://graph.microsoft.com/v1.0/me`
- **Scopes**: `XboxLive.signin offline_access openid profile email`

### Token Lifecycle
1. **Device Code Flow**: User sees a code, enters it at `https://microsoft.com/link`
2. **Polling**: Rust polls token endpoint every 5s (slows down to 10s+ on `slow_down`)
3. **Token storage**: Access + refresh tokens stored in OS keyring via `keyring` crate
4. **Refresh**: `auth_refresh_token` Tauri command renews access token before expiry
5. **Logout**: Clears keyring, best-effort token revocation
6. **Token expiry**: Refresh tokens for native/public clients have a 90-day rolling window; if unused for 90 days, they expire.

### Common Pitfalls
| Error | Cause | Fix |
|-------|-------|-----|
| `AADSTS700016` | App not found in tenant | Register your own app; don't use legacy IDs |
| `unauthorized_client` | Public client flow disabled | Enable "Allow public client flows" in Azure Portal |
| `invalid_grant` | Refresh token expired | User must re-authenticate |
| 400 on `/devicecode` | Wrong tenant / client ID | Use `/common` not `/consumers` or `/organizations` |
| `AADSTS50020` | User account doesn't exist in tenant | Use `/common` (routes to correct tenant) |

### Legacy ID `00000000402b5328`
This was Microsoft's own client ID for old Xbox Live / Minecraft Bedrock auth.
- It was never intended for use by third-party applications.
- Microsoft has decommissioned it from the v2.0 endpoint.
- You MUST register your own app in Azure Portal.

## Tech Stack Overview

### Frontend

* **React** (TypeScript) – UI framework
* **Vite** – frontend bundler and dev server
* **shadcn/ui** – UI component primitives (built on Radix + Tailwind)
* **Tailwind CSS** – utility-first styling
* **Zustand** – state management
* **Zod** – schema validation

### Backend (Desktop)

* **Tauri v2** – desktop application framework
* **Rust** – backend logic and system integration

### Tooling & Quality

* **Vitest** – unit testing framework (with `jsdom`)
* **Testing Library** – component testing utilities
* **Biome** – linting and formatting
* **TypeScript** – static typing
* **knip** – dead code detection
* **cspell** – spell checking

### Optional / Service Integrations

* **Convex** – backend/database (if enabled)
* **Resend** – email delivery (if enabled)

## Notes
- After completing the request, commit the changes to a local git repository. Branch: master
- Use Bun > pnpm > npm
- Play with rounded corners and squircles if you think its fitting for that specific object.