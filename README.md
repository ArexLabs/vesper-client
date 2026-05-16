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

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, shadcn/ui, Zustand, Zod
- **Backend**: Rust, Tauri v2, reqwest
- **Modrinth**: `@modrinth/api-client` (official TypeScript SDK)
