# UI, UX, and Developer Experience (DX)

## Design Philosophy

Vesper follows a minimal, functional design language. The interface is crafted to feel responsive and polished without drawing attention to itself. Every visual detail serves a purpose: reducing cognitive load, clarifying state, or guiding the user's next action.

### Principles

- **Clarity over decoration**. Every element earns its place. If removing it does not degrade the experience, remove it.
- **Substance before style**. Visual polish enhances usability; it never compensates for missing functionality or unclear copy.
- **Progressive disclosure**. Surface common actions; nest advanced options. Do not overwhelm the user on first launch.
- **Performance is a feature**. Animations and transitions are GPU-friendly and never block interaction. Users with `prefers-reduced-motion` see no motion at all.

---

## Color System

### Palette

The application uses a neutral base with amber accents, defined as OKLCH values in CSS custom properties. All colors are semantic -- they describe purpose, not appearance.

| Token | Purpose |
|---|---|
| `--background` / `--foreground` | Base page surface and primary text |
| `--card` / `--card-foreground` | Elevated surface (cards, dialogs) |
| `--muted` / `--muted-foreground` | Secondary surfaces and subdued text |
| `--primary` / `--primary-foreground` | Call-to-action elements |
| `--destructive` / `--destructive-foreground` | Irreversible actions (delete) |
| `--border` / `--input` | Separators and form controls |
| `--ring` | Focus indicators |
| `--sidebar-*` | Sidebar-specific surface and accent |
| `--success` / `--warning` / `--danger` | Semantic feedback signals |

Legacy tokens (`--bg`, `--surface-1`, `--surface-2`, `--surface-3`, `--text`, `--text-muted`) are maintained as aliases for backward compatibility with existing component classes.

### Usage

```tsx
// Good -- semantic tokens
<div className="bg-background text-foreground" />
<Button variant="destructive">Delete</Button>

// Avoid -- direct color values
<div className="bg-[#0a0a0a] text-white" />
```

---

## Typography

- **UI font**: Satoshi (variable, self-hosted)
- **Monospace**: JetBrains Mono (self-hosted)
- Font loading uses `font-display: swap` to prevent invisible text during load
- Default sizes use Tailwind's type scale; avoid custom font-size values

---

## Animations and Motion

### Philosophy

Animations in Vesper are subtle micro-interactions that provide spatial continuity and feedback. They are never gratuitous. The motion system is built on the Rombo plugin (`tailwindcss-motion`), which uses GPU-composited CSS properties (`transform`, `opacity`) and automatically respects `prefers-reduced-motion`.

### When to Animate

| Situation | Animation | Class |
|---|---|---|
| Modal / dialog entrance | Slide up + fade in | `motion-preset-slide-up` + `motion-preset-fade` |
| Page content entrance | Subtle fade in | `motion-preset-fade motion-duration-500` |
| Card hover | Lift + scale | `motion-safe:hover:-translate-y-0.5 motion-safe:hover:scale-[1.01]` |
| Overlay backdrop | Quick fade | `motion-preset-fade motion-duration-200` |
| Sidebar nav items | Staggered fade | `motion-preset-fade motion-duration-400` |

### How to Animate

Use Rombo motion classes directly on JSX elements:

```tsx
<div className="motion-preset-fade motion-duration-300 motion-ease-spring-smooth">
  Content
</div>
```

The `motion-safe:` prefix is used for hover/interaction animations to ensure they only run when the user has no motion preferences.

### Available Classes

**Base animation utilities:**
- `motion-opacity-in-{value}` -- Start opacity
- `motion-translate-y-in-{value}` -- Start vertical offset
- `motion-translate-x-in-{value}` -- Start horizontal offset
- `motion-scale-in-{value}` -- Start scale
- `motion-rotate-in-{value}` -- Start rotation
- `motion-blur-in-{value}` -- Start blur

**Modifiers:**
- `motion-duration-{ms}` -- Animation duration (100-1000)
- `motion-delay-{ms}` -- Animation delay
- `motion-ease-{name}` -- Easing function (spring-smooth, out-quint, etc.)

**Presets:**
- `motion-preset-fade` -- Opacity only
- `motion-preset-slide-up` -- Slide up + fade
- `motion-preset-blur-up` -- Blur + slide up + fade
- `motion-preset-expand` -- Scale + fade
- `motion-preset-focus` -- Scale + blur + fade

### Reduced Motion

The application includes a global `prefers-reduced-motion` media query in `globals.css` that disables all animations and transitions when the user's system preference is set to reduce motion. The Rombo plugin also respects this automatically.

---

## Spacing and Layout

- Use `gap-*` on flex/grid containers instead of `space-y-*` / `space-x-*`
- Main content area has a max-width of 1180px
- Sidebar has two states: expanded (248px) and collapsed (96px)
- Consistent padding: `p-5` on cards, `px-5 py-5` on main content area

## Component Patterns

### shadcn/ui Conventions

This project uses shadcn/ui components with the Base UI (formerly Radix) primitives. When creating or modifying components:

1. Prefer composition over configuration. Use the compound component pattern (e.g., `Card`, `CardHeader`, `CardTitle`, `CardContent`).
2. Use semantic color tokens for all styling.
3. Add proper ARIA attributes for accessibility.
4. Use the `cn()` utility for class merging.

### Form Fields

Use Base UI's `Field` and `FieldGroup` components for form layout. Validation states use `data-invalid` on `Field` and `aria-invalid` on the control element.

### Icon Conventions

- Use `lucide-react` icons throughout
- Icons inside buttons use the `data-icon` attribute (`data-icon="inline-start"` or `data-icon="inline-end"`)
- Icon sizing uses `size-4` (or other `size-*` values when width equals height)

---

## Developer Experience (DX)

### Path Aliases

Use `@/` for all imports from `src/`:

```typescript
import { Button } from "@/components/ui/button";
import { useLauncherStore } from "@/store/launcher-store";
```

No relative `../` imports across directory boundaries.

### State Management

All application state lives in a single Zustand store (`src/store/launcher-store.ts`). The store:

- Persists state to the Tauri backend (with localStorage fallback for browser mode)
- Uses Zod schemas for runtime validation
- Uses `structuredClone` for immutable updates
- Provides action methods that encapsulate mutation logic

### Internationalization

Translations are YAML files in `public/language/`. Add a new language:

1. Create `public/language/{code}.yaml` with all translation keys
2. Add the language code to `LANGUAGES` array in `src/lib/i18n/setup.ts`
3. Add the display label to `LANGUAGE_LABELS` in the same file
4. Update the `languageSchema` in `src/lib/schemas.ts`

### Version Bumps

When updating dependencies via Dependabot PRs:

1. Review the changelog for breaking changes
2. Update the version in `package.json` or `Cargo.toml`
3. Run `npm install` or `cargo update`
4. Run full quality checks (`npm run codechecker` and cargo check)
5. Fix any type errors, build failures, or test failures
6. For Tailwind CSS major upgrades, expect PostCSS plugin changes and config migration

### Local Development

```bash
npm run dev:server     # Fast web-only development (no Rust compilation)
npm run dev            # Full Tauri desktop app (includes Rust build)
npm run test:run       # Unit tests
npm run test:e2e       # Playwright end-to-end tests
```

### Common Tasks

**Adding a new page:**
1. Create the component in `src/routes/`
2. Register the route in `src/lib/router.tsx`
3. Add the navigation link in `src/components/layout/Sidebar.tsx`

**Adding a new Tauri command:**
1. Create the command function in `src-tauri/src/commands/`
2. Register it in `mod.rs`
3. Add the command handler in `src-tauri/src/lib.rs`
4. Create the frontend wrapper in `src/lib/ipc.ts`
5. Add the store method in `src/store/launcher-store.ts`

**Adding a new translation:**
1. Create `public/language/{code}.yaml`
2. Add the code to `LANGUAGES` in `src/lib/i18n/setup.ts`
3. Add the label to `LANGUAGE_LABELS` in the same file
4. Update `languageSchema` in `src/lib/schemas.ts`
