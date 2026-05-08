# Architecture Overview

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 18 + TypeScript |
| Bundler | Vite 5 |
| Styling | Tailwind CSS + shadcn/ui primitives |
| State Management | Zustand |
| Schema Validation | Zod |
| Desktop Shell | Tauri v2 (Rust) |
| Package Manager | npm |

## Project Structure

```
vesper-client/
├── src/                    # Frontend (React + TypeScript + Vite)
│   ├── components/         # React components
│   │   ├── ui/             # shadcn/ui primitives (button, card, input, etc.)
│   │   ├── discover/       # Modrinth discover/search UI
│   │   ├── instances/      # Instance management UI
│   │   ├── layout/         # Layout components (sidebar, title bar, etc.)
│   │   └── account/        # Account/Auth UI
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Core utilities and API clients
│   ├── store/              # Zustand stores
│   ├── pages/              # Page-level components
│   ├── routes/             # Route/page components
│   ├── styles/             # Global styles
│   └── test/               # Test setup
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── commands/       # Tauri command handlers
│   │   ├── models/         # Data models (serde)
│   │   ├── services/       # Business logic
│   │   ├── error.rs        # Error types
│   │   └── lib.rs          # Module entry point
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri configuration
├── docs/                   # Project documentation
├── package.json            # Node dependencies
├── tsconfig.json           # TypeScript configuration
└── vite.config.ts          # Vite configuration
```

## Data Flow

1. **UI layer** (React components) dispatches actions through Zustand stores or calls hooks
2. **Hooks** orchestrate calls to `src/lib/` utilities
3. **Library layer** (`src/lib/`) handles API communication:
   - Tauri `invoke()` for native desktop operations
   - `@modrinth/api-client` for Modrinth API calls
   - Native `fetch()` for external APIs (Mojang launcher meta)
4. **Tauri backend** (Rust) handles:
   - File system operations (instance creation, downloads)
   - Authentication flows (Microsoft OAuth)
   - Secure storage (refresh tokens)

## Dual-Mode Runtime

The app runs in two modes:
- **Web mode**: Runs in a browser via `npm run dev`
- **Desktop mode**: Runs as a Tauri desktop app via `npm run tauri:dev`

All desktop operations use `try-invoke-fallback` pattern: try Tauri `invoke` first, fall back to web-compatible implementation.
