# Vesper Launcher

A desktop Minecraft launcher built with Tauri v2, React, and TypeScript.
We state that the launcher was written using AI, but because of this, it does not mean, that it is bad.

## Documentation

See the [docs/](docs/README.md) directory for detailed guides:

- [Architecture Overview](docs/architecture.md)
- [Frontend Guide](docs/frontend.md)
- [Backend Guide](docs/backend.md)
- [Modrinth API Integration](docs/modrinth-api.md)
- [Testing Guide](docs/testing.md)

## Quick Start

```bash
npm install
npm run tauri:dev    # Desktop app
npm run dev:server   # Web-only mode (browser)
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Alias for `tauri:dev` |
| `npm run dev:server` | Vite dev server (browser) |
| `npm run build` | Frontend production build |
| `npm run tauri:build` | Desktop app package |
| `npm run lint` | Biome linting |
| `npm run format` | Biome formatting |
| `npm run typecheck` | TypeScript type check |
| `npm run test` / `test:run` | Vitest (watch / single run) |

## Microsoft Entra ID Setup (Authentication Key)

Vesper uses Microsoft account sign-in via OAuth 2.0 Device Code Flow. You **must register your own app** in the Azure Portal — the app will not work with the placeholder client ID.

### Step-by-step Registration

1. Go to the [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations** → **New registration**

2. Fill in the registration form:

   | Field | Value |
   |---|---|
   | **Name** | `Vesper Launcher` (or any name you prefer) |
   | **Supported account types** | "Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)" |
   | **Redirect URI** | Leave **empty** (Device Code Flow does not use redirect URIs) |

3. Click **Register**. On the overview page, copy the **Application (client) ID** — this is your key.

4. Go to **Authentication** → **Advanced settings** → Set **"Allow public client flows"** to **Yes** → **Save**. (This is required for Device Code Flow.)

5. (Optional) Go to **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions** → Add `User.Read` if you want the app to fetch your display name. The core scopes (`offline_access`, `openid`, `profile`, `email`) are requested at runtime and don't need to be pre-configured.

### Set the Key

The app reads the client ID from the `VESPER_AZURE_CLIENT_ID` environment variable.

**Quick start (development):**  
A `.env` file in the project root is loaded automatically:
```bash
VESPER_AZURE_CLIENT_ID=f358b680-84e8-4e52-a4ff-10ed351d1cb9
```
(This is already set up in the repo's `.env` file — it's gitignored so it won't be committed.)

**Manual override for production builds:**
```bash
VESPER_AZURE_CLIENT_ID="your-client-id-here" npm run tauri:build
```

If the env var is not set, the app falls back to `"YOUR_CLIENT_ID_HERE"` — authentication will fail until you set the real value.

### Why Can't I Use the Built-in Default?

Previous versions of this app used the client ID `00000000402b5328`, which was Microsoft's own internal ID for old Xbox Live / Minecraft Bedrock auth. It was never intended for third-party apps and has been decommissioned from the v2.0 endpoint. You **must** register your own app in the Azure Portal.

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, shadcn/ui, Zustand, Zod
- **Backend**: Rust, Tauri v2, reqwest
- **Modrinth**: `@modrinth/api-client` (official TypeScript SDK)
