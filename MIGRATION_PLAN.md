# GPUI Migration Plan

This document tracks the migration from Slint 1.17 to GPUI 0.2.2 for the Vesper Client UI layer.

## Status

- **Current**: Login page prototype — compiles and runs
- **Next**: Full app shell with sidebar + all pages
- **Complete when**: All 7 .slint files replaced, old files deleted, no Slint dependencies remain

## Architecture Decisions

### Why GPUI?

| Factor | Slint 1.17 | GPUI 0.2.2 |
|---|---|---|
| Rendering | Proprietary renderer | GPU-accelerated (wgpu) |
| UI Language | Custom DSL (.slint) | Pure Rust |
| Type Safety | Separate DSL compilation | Single Rust compilation unit |
| Theming | Built-in CSS-like | Tailwind-style API (Rust) |
| Maintenance | Mature, stable | Pre-1.0, Zed actively develops |
| Ecosystem | Separate from Zed | Powers Zed editor |

### Key Constraint: `!Send` Types

`AuthManager` contains `reqwest::Client` and `oauth2` internals that are `!Send`. GPUI 0.2.2's `cx.spawn()` requires `AsyncFnOnce` with lifetime bounds that prevent moving `!Send` types into async closures.

**Solution**: Spawn a dedicated OS thread with its own tokio runtime for each async operation. Write results to `Arc<Mutex<Option<UiUpdate>>>`.

### Key Constraint: No Built-in Widgets

GPUI 0.2.2 has no `Button`, `TextInput`, `ComboBox`, `ListView`, or `ProgressIndicator` widgets. All UI is composed from `div()` elements with Tailwind-style styling.

**Solution**: Build a component library in `ui/components/` that wraps common patterns.

## Migration Phases

### Phase 1: Login (DONE)

**Files**: `login_view.rs`, `theme.rs`, `main.rs`, `ui/mod.rs`

| Slint | GPUI Equivalent |
|---|---|
| `LoginPage` component | `LoginView` struct + `impl Render` |
| `LineEdit` | `div().child(text_input)` |
| `Button` | `div().id("btn").on_click().hover()` |
| `Rectangle` background | `.bg(Theme::color())` |
| `VerticalBox` | `div().flex().flex_col()` |
| `HorizontalBox` | `div().flex()` |
| `Text` | `div().text_xl().text_color().child("...")` |
| `TouchArea` click | `.on_click(cx.listener(...))` |
| `visible:` property | `.when(condition, \|el\| ...)` |
| `callback login-requested()` | Direct method call via `cx.listener` |

**Status**: Complete and compiling.

### Phase 2: App Shell + Sidebar

**Files**: `app.rs`, `sidebar.rs`, `navigation.rs`

The old `app.slint` had a sidebar with 4 `SidebarButton` components and page switching via `current-page: int`. GPUI needs a navigation model.

#### Navigation Architecture

```rust
// vesper-client/src/ui/navigation.rs

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Page {
    Home,
    Instances,
    Mods,
    Settings,
}

pub struct AppState {
    pub current_page: Page,
    pub is_logged_in: bool,
    pub username: SharedString,

    // Shared state for all views
    pub latest_update: Arc<Mutex<Option<UiUpdate>>>,

    // Instance state
    pub instances: Vec<InstanceInfo>,
    pub show_create_form: bool,

    // Mod state
    pub search_query: SharedString,
    pub search_results: Vec<ModInfo>,
    pub installed_mods: Vec<InstalledModInfo>,
    pub active_source: SharedString,
    pub is_searching: bool,
    pub downloading_mod: SharedString,
    pub download_progress: f32,

    // Settings state
    pub java_path: SharedString,
    pub max_memory: i32,
    pub jvm_args: SharedString,

    // Launch overlay
    pub launch_overlay_visible: bool,
    pub launch_stage: SharedString,
    pub launch_progress: f32,
}
```

#### Sidebar Component

```rust
// vesper-client/src/ui/sidebar.rs

pub struct Sidebar {
    active_page: Page,
    is_logged_in: bool,
    username: SharedString,
}

impl Render for Sidebar {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        div()
            .flex()
            .flex_col()
            .w_48()
            .bg(Theme::mantle())
            .p_4()
            .gap_2()
            .child(
                div()
                    .text_2xl()
                    .font_weight(FontWeight(700.0))
                    .text_color(Theme::mauve())
                    .child("Vesper"),
            )
            .child(
                div()
                    .text_xs()
                    .text_color(Theme::overlay0())
                    .child(if self.is_logged_in {
                        self.username.to_string()
                    } else {
                        "Not signed in".to_string()
                    }),
            )
            // Sidebar buttons
            .child(self.sidebar_button(cx, "Home", Page::Home))
            .child(self.sidebar_button(cx, "Instances", Page::Instances))
            .child(self.sidebar_button(cx, "Mods", Page::Mods))
            .child(self.sidebar_button(cx, "Settings", Page::Settings))
    }
}
```

#### App Window

```rust
// vesper-client/src/ui/app.rs

pub struct App {
    current_page: Page,
    sidebar: Entity<Sidebar>,
    // ... all page views (created lazily or eagerly)
}
```

#### Old .slnit Reference

```
app.slint:9-31   SidebarButton component
app.slint:33-181 AppWindow with sidebar + page switching
```

### Phase 3: Instances Page

**Files**: `instances_view.rs`, `components/instance_card.rs`, `components/create_form.rs`

The old `instances.slint` had:
- `CreateInstanceForm` with text inputs and combo boxes
- `InstancesPage` with a list of `InstanceEntry` cards
- Each card shows name, MC version badge, loader badge, Play/Delete buttons
- Empty state: "No instances yet. Create your first one!"

#### GPUI View Structure

```rust
pub struct InstancesView {
    instances: Vec<InstanceInfo>,
    show_create_form: bool,
    form_name: SharedString,
    form_mc_version: SharedString,
    form_loader: SharedString,
    form_loader_version: SharedString,
    latest_update: Arc<Mutex<Option<UiUpdate>>>,
}
```

#### Components to Build

| Component | Slint Source | GPUI Implementation |
|---|---|---|
| `InstanceCard` | `instances.slint:122-186` | `div()` with name, badges, buttons |
| `CreateInstanceForm` | `instances.slint:4-70` | `div()` with text inputs + button |
| `InstanceBadge` | inline in card | `div().bg(Theme::surface1()).rounded().px().child("MC 1.21.1")` |
| Empty state | `instances.slint:112-120` | `div().child("No instances yet.")` |

#### GPUI TextInput Pattern

```rust
// No built-in TextInput — use div + on_click to trigger focus
// or use a stateful approach with keyboard events

div()
    .id("name-input")
    .px_3()
    .py_2()
    .rounded_md()
    .bg(Theme::surface1())
    .text_color(Theme::text())
    .child(self.form_name.clone())
    .on_click(cx.listener(|this, _event, _window, cx| {
        // Focus or open input dialog
    }))
```

> **Note**: GPUI 0.2.2 may not have a text input widget. If so, consider:
> 1. Using a minimal text input from the GPUI source (Zed has `TextInput` internally)
> 2. Implementing a simple input via `on_key_event`
> 3. Using a separate dialog/overlay for text input

### Phase 4: Mods Page

**Files**: `mods_view.rs`, `components/mod_card.rs`

The old `mods.slint` had:
- Search bar with text input
- Source selector (Modrinth / CurseForge combo box)
- Download progress indicator
- Search results list with name, description, download count, Install button
- Installed mods list (fallback when no search results)
- Empty state: "No mods installed yet"

#### GPUI View Structure

```rust
pub struct ModsView {
    search_query: SharedString,
    search_results: Vec<ModInfo>,
    installed_mods: Vec<InstalledModInfo>,
    active_source: SharedString,
    is_searching: bool,
    downloading_mod: SharedString,
    download_progress: f32,
    latest_update: Arc<Mutex<Option<UiUpdate>>>,
}
```

#### Components to Build

| Component | Slint Source | GPUI Implementation |
|---|---|---|
| `ModCard` | `mods.slint:87-121` | `div()` with name, description, downloads, Install button |
| `DownloadBar` | `mods.slint:51-70` | `div().flex()` with progress text + animated bar |
| `SearchBar` | `mods.slint:32-49` | `div().flex()` with input + source selector + Search button |

#### Progress Indicator

GPUI has no built-in progress bar. Build one:

```rust
fn progress_bar(progress: f32) -> impl IntoElement {
    div()
        .h_1()
        .w_full()
        .rounded()
        .bg(Theme::surface1())
        .child(
            div()
                .h_full()
                .rounded()
                .bg(Theme::mauve())
                .w(relative(progress.clamp(0.0, 1.0)))
        )
}
```

### Phase 5: Settings Page

**Files**: `settings_view.rs`

The old `settings.slint` had:
- Java Path input + Detect button
- Max Memory display
- JVM Args input
- Save Settings button

#### GPUI View Structure

```rust
pub struct SettingsView {
    java_path: SharedString,
    max_memory: i32,
    jvm_args: SharedString,
    latest_update: Arc<Mutex<Option<UiUpdate>>>,
}
```

#### Components to Build

| Component | Slint Source | GPUI Implementation |
|---|---|---|
| `SettingRow` | `settings.slint:34-63` | `div().flex()` with label + input area |
| `DetectButton` | `settings.slint:44-47` | `div().id("detect-btn").on_click()` |
| `SaveButton` | `settings.slint:65-70` | `div().id("save-btn").on_click()` |

### Phase 6: Launch Overlay

**Files**: `components/launch_overlay.rs`

The old `launch.slint` had:
- Semi-transparent black overlay
- "Vesper Client" title
- Stage text (e.g., "Downloading libraries...")
- Progress indicator (determinate or indeterminate)

#### GPUI Implementation

```rust
pub struct LaunchOverlay {
    visible: bool,
    stage: SharedString,
    progress: f32,
}

impl Render for LaunchOverlay {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        div()
            .absolute()
            .inset_0()
            .flex()
            .flex_col()
            .items_center()
            .justify_center()
            .bg(gpui::rgb(0x000000).opacity(0.8))
            .when(self.visible, |this| {
                this.child(
                    div()
                        .flex()
                        .flex_col()
                        .items_center()
                        .gap_4()
                        .child(
                            div()
                                .text_xl()
                                .font_weight(FontWeight(700.0))
                                .text_color(Theme::text())
                                .child("Vesper Client"),
                        )
                        .child(
                            div()
                                .text_base()
                                .text_color(Theme::subtext0())
                                .child(self.stage.clone()),
                        )
                        .child(progress_bar(self.progress)),
                )
            })
    }
}
```

## Component Library (`ui/components/`)

### Reusable Components to Build

| Component | Used By | Description |
|---|---|---|
| `button()` | All views | Styled div with hover + click |
| `text_input()` | Instances, Settings, Mods | Text input field (or dialog) |
| `badge()` | Instances | Colored tag (MC version, loader) |
| `progress_bar()` | Mods, Launch | Determinate/indeterminate progress |
| `card()` | Instances, Mods | Rounded container with bg |
| `empty_state()` | Instances, Mods | Centered "nothing here" message |
| `error_text()` | All views | Red error message |
| `sidebar_button()` | Sidebar | Active/inactive nav button |

### Button Helper

```rust
pub fn button(label: &str, on_click: impl Fn(&mut ClickEvent) + 'static) -> impl IntoElement {
    div()
        .id(SharedString::from(format!("btn-{}", label)))
        .px_4()
        .py_2()
        .rounded_md()
        .bg(Theme::mauve())
        .text_color(Theme::base())
        .text_sm()
        .cursor_pointer()
        .child(label)
        .hover(|style| style.bg(Theme::blue()))
        .on_click(on_click)
}
```

### Badge Helper

```rust
pub fn badge(text: &str, color: Rgba) -> impl IntoElement {
    div()
        .px_2()
        .py_0_5()
        .rounded()
        .bg(Theme::surface1())
        .text_xs()
        .text_color(color)
        .child(text)
}
```

## GPUI API Reference (Lessons Learned)

### Imports Required

```rust
use gpui::{
    Context, FontWeight, InteractiveElement, ParentElement, Render,
    SharedString, StatefulInteractiveElement, Styled, Window, div,
    prelude::FluentBuilder,
};
```

### Layout

```rust
div()
    .flex()                    // display: flex
    .flex_col()                // flex-direction: column
    .items_center()            // align-items: center
    .justify_center()          // justify-content: center
    .gap_4()                   // gap: 1rem
    .p_8()                     // padding: 2rem
    .w_48()                    // width: 12rem
    .h_full()                  // height: 100%
    .size_full()               // width: 100%, height: 100%
    .inset_0()                 // top/right/bottom/left: 0
    .absolute()                // position: absolute
```

### Colors & Text

```rust
div()
    .bg(Theme::base())         // background color
    .text_color(Theme::text()) // text color
    .text_2xl()                // font-size: 1.5rem
    .text_base()               // font-size: 1rem
    .text_sm()                 // font-size: 0.875rem
    .text_xs()                 // font-size: 0.75rem
    .font_weight(FontWeight(700.0))  // bold
    .rounded_2xl()             // border-radius: 1rem
    .rounded_md()              // border-radius: 0.375rem
    .shadow_lg()               // box-shadow
```

### Interactivity

```rust
div()
    .id("my-element")          // REQUIRED for on_click
    .cursor_pointer()          // cursor: pointer
    .on_click(cx.listener(|this, _event, _window, cx| {
        // handle click
    }))
    .hover(|style| style.bg(Theme::blue()))  // hover state
```

### Conditional Rendering

```rust
div()
    .when(self.is_logged_in, |this| {
        this.child(div().child("Welcome back!"))
    })
    .when(!self.is_logged_in, |this| {
        this.child(div().child("Please sign in"))
    })
```

### Theme

```rust
// vesper-client/src/ui/theme.rs
pub struct Theme;
impl Theme {
    pub fn base() -> Rgba { rgb(0x11111b) }
    pub fn mantle() -> Rgba { rgb(0x181825) }
    pub fn surface0() -> Rgba { rgb(0x1e1e2e) }
    pub fn surface1() -> Rgba { rgb(0x313244) }
    // ... more colors
}
```

Note: `rgb()` is not `const` — colors must be `fn()`, not `const`.

## File Migration Mapping

| Old File (Slint) | New File (GPUI) | Status |
|---|---|---|
| `app.slint` | `app.rs` + `navigation.rs` | Planned |
| `login.slint` | `login_view.rs` | Done |
| `instances.slint` | `instances_view.rs` | Planned |
| `mods.slint` | `mods_view.rs` | Planned |
| `settings.slint` | `settings_view.rs` | Planned |
| `launch.slint` | `components/launch_overlay.rs` | Planned |
| `types.slint` | `ui/types.rs` (Rust structs) | Planned |
| `build.rs` | Deleted (no build script needed) | Done |

## Implementation Order

1. **Phase 2**: App shell + sidebar + navigation
   - Create `navigation.rs` with `Page` enum and `AppState`
   - Create `sidebar.rs` with nav buttons
   - Create `app.rs` that composes sidebar + page views
   - Update `main.rs` to use `App` instead of `LoginView`
   - Move `LoginView` to render when `Page::Home`

2. **Phase 3**: Instances page
   - Create `instances_view.rs`
   - Build `InstanceCard`, `CreateInstanceForm` components
   - Wire up `BackendCommand::InstanceCreate`, `InstanceList`, `InstanceDelete`

3. **Phase 4**: Mods page
   - Create `mods_view.rs`
   - Build `ModCard`, `DownloadBar`, `SearchBar` components
   - Wire up `BackendCommand::ModSearch`, `ModDownload`, `ModListInstalled`

4. **Phase 5**: Settings page
   - Create `settings_view.rs`
   - Build `SettingRow` component
   - Wire up `BackendCommand::SettingsSave`, `DetectJava`

5. **Phase 6**: Launch overlay
   - Create `components/launch_overlay.rs`
   - Build `progress_bar()` helper
   - Wire up `BackendCommand::LaunchInstall`, `LaunchStart`

6. **Cleanup**: Delete old .slint files, remove dead code warnings

## Testing Strategy

Each phase should be verified:

```bash
# Compile check
cargo check

# Run and visually verify
cargo run

# Check for dead code warnings
cargo clippy 2>&1 | grep "dead_code"

# Run tests
cargo test
```

Visual verification checklist per page:
- [ ] Layout matches Slint version
- [ ] Colors use Catppuccin Mocha palette
- [ ] Click handlers fire and update state
- [ ] Conditional rendering works (e.g., loading states)
- [ ] Shared state updates reflect in UI
