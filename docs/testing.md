# Testing Guide

## Framework

- **Vitest** — Test runner
- **jsdom** — DOM environment for component tests
- **@testing-library/jest-dom** — DOM matchers (setup in `src/test/setup.ts`)

## Running Tests

```bash
npm run test       # Watch mode
npm run test:run   # Single run
```

## Test Conventions

- Test files use `*.test.ts` naming
- Tests live alongside source files (e.g., `src/lib/config.test.ts`)
- Only utility/module logic is tested (no UI component tests yet)

## Quality Checks

Before opening a PR, run the full quality suite:

```bash
npm run lint      # Biome checks
npm run typecheck # TypeScript type checks
npm run test:run  # Vitest
npm run build     # Vite build
```

## Code Formatting

Biome handles both formatting and linting:

```bash
npm run format    # Format with Biome
```

Configuration is in `biome.json` with 2-space indentation, double quotes, and trailing commas.
