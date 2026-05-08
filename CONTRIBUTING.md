# Contributing to Vesper Launcher

## Development Setup

### Prerequisites

- Node.js >= 20
- pnpm >= 10 or npm
- Rust toolchain (stable)
- Tauri v2 system dependencies (see Tauri docs for your platform)

### Getting Started

```bash
git clone <repo-url>
cd vesper-client
pnpm install
pnpm dev:server    # Vite dev server (browser-only)
pnpm tauri:dev     # Full desktop app
```

### Code Quality

Run all quality checks before opening a PR:

```bash
pnpm codechecker
```

This runs knip (dead code), cspell (spelling), Biome (lint), and TypeScript type checking.

Individual commands:

```bash
pnpm lint          # Biome lint
pnpm format        # Biome format
pnpm typecheck     # TypeScript type check
pnpm test:run      # Vitest unit tests
pnpm build         # Frontend production build
```

### Rust Backend

```bash
cargo check --manifest-path src-tauri/Cargo.toml
cargo build --manifest-path src-tauri/Cargo.toml
```

## Architecture

See `docs/` for detailed documentation:

- `docs/architecture.md` - High-level project structure
- `docs/frontend.md` - Frontend component patterns
- `docs/backend.md` - Rust backend commands and IPC
- `docs/ui-ux-dx.md` - UI, UX, and developer experience guidelines
- `docs/testing.md` - Testing strategy

## Project Structure

```
src/
  components/     React components (colocated by domain)
  routes/         Page-level route components
  lib/            Utilities, config, i18n, schemas
  store/          Zustand state management
  styles/         Global CSS (Tailwind v4 theme, layers)
  e2e/            Playwright end-to-end tests
src-tauri/
  src/            Rust backend (commands, services, models)
  Cargo.toml      Rust dependencies
public/
  language/       YAML translation files
  fonts/          Self-hosted fonts (Satoshi, JetBrains Mono)
```

## Code Conventions

### General

- 2-space indentation, no tabs
- Double quotes for strings
- Trailing commas in multiline statements
- Descriptive kebab-case filenames for components
- PascalCase for React components and TypeScript types
- camelCase for variables and functions

### Imports

Use the `@/` path alias for all cross-directory imports. No relative `../` imports outside the same directory.

```typescript
// Good
import { Button } from "@/components/ui/button";
import { useStore } from "@/store/launcher-store";

// Avoid
import { Button } from "../../components/ui/button";
```

### Styling

This project uses Tailwind CSS v4 with the Rombo motion plugin for animations.

- Use Tailwind utility classes for layout and spacing
- Use `gap-*` instead of `space-y-*` / `space-x-*`
- Use semantic color tokens (`bg-background`, `text-muted-foreground`, etc.)
- Use `motion-*` classes from Rombo for entrance/exit animations
- Respect `prefers-reduced-motion` (handled automatically by Rombo and Tailwind)

### Animations

Animation guidelines are documented in `docs/ui-ux-dx.md`. Key principles:

- Subtle and performant micro-interactions only
- GPU-friendly properties (transform, opacity)
- Use Rombo motion classes (`motion-preset-*`, `motion-translate-*`, `motion-opacity-*`)
- Entrance animations on modals and page content
- Hover lift effects on cards and interactive elements
- Keep durations short (200-500ms)

## Pull Request Process

1. Run `pnpm codechecker` locally
2. Write or update tests for behavior changes
3. Update documentation if adding new features
4. Keep commits focused and use conventional commit messages
5. Link related issues in the PR description

## Commit Conventions

Use conventional commits:

```
feat: add Microsoft device login flow
fix: correct Sort dropdown display value
refactor: migrate Tailwind v3 to v4 configuration
test: add unit tests for config merging
docs: document animation guidelines
```

## Testing

- Unit tests: Vitest with jsdom (`src/*.test.ts`)
- Component tests: Testing Library
- E2E tests: Playwright (`src/e2e/`)

Run relevant tests for your changes and ensure CI passes before requesting review.
