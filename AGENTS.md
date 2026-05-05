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
- `npm run format`: format code with Biome
- `npm run typecheck`: run TypeScript type checks
- `npm run test` / `npm run test:run`: run Vitest (watch / single run)
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

### Optional / Service Integrations

* **Convex** – backend/database (if enabled)
* **Resend** – email delivery (if enabled)

## Notes
- After completing the request, commit the changes to a local git repository. Branch: master
- Use Bun > pnpm > npm
- Play with rounded corners and squircles if you think its fitting for that specific object.