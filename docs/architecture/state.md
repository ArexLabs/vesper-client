# State Management Across Threads

Vesper Client manages application state across two threads with different ownership models: the GPUI main thread holds view structs implementing `Render`, while the background thread holds `Arc`-wrapped domain managers and writes updates via shared `Arc<Mutex<Option<UiUpdate>>>`.

## State Ownership

### Main Thread (GPUI)

Each view is a GPUI entity with owned state:

```rust
pub struct LoginView {
    is_logged_in: bool,
    username: SharedString,
    is_polling: bool,
    auth_error: SharedString,
    cmd_tx: mpsc::Sender<BackendCommand>,
    latest_update: Arc<Mutex<Option<UiUpdate>>>,
}
```

Views are created via `cx.new(|cx| LoginView::new(...))` and stored as GPUI entities. State is modified in event handlers and polled during `Render::render()`.

### Background Thread

Domain managers live on the background thread:

```rust
let auth_manager = AuthManager::new(client_id)?;
let instance_manager = InstanceManager::new()?;
let mod_manager = ModManager::new(instance_manager.clone(), None)?;
```

Each background task clones or creates its own managers. They are not shared across threads.

### Shared State Bridge

```rust
let latest_update: Arc<Mutex<Option<UiUpdate>>> = Arc::new(Mutex::new(None));
```

This is the primary communication channel. The background thread writes updates; the main thread polls and consumes them in `Render::render()`.

## Config Persistence

### VesperConfig

Global configuration stored at `{data_dir}/vesper_config.toml`:

```rust
pub struct VesperConfig {
    pub profiles: Vec<AuthProfile>,
    pub active_profile_id: Option<String>,
    pub java_path: Option<String>,
    pub max_memory_mb: u32,
    pub jvm_args: Option<String>,
    pub window_width: u32,           // default: 1100
    pub window_height: u32,          // default: 700
}
```

Load/save is synchronous (`std::fs`), called from the main thread at startup and from background threads when saving settings.

### InstanceConfig

Per-instance configuration stored at `{data_dir}/instances/{id}/instance.toml`:

```rust
pub struct InstanceConfig {
    pub name: String,
    pub mc_version: String,
    pub loader_type: LoaderType,
    pub loader_version: Option<String>,
    pub created_at: String,
    pub last_played: Option<String>,
}
```

Instance configs are managed by `InstanceManager` which reads/writes to the filesystem.

## Auth State Lifecycle

1. **Startup**: `VesperConfig::load()` reads stored profiles. The view is initialized with default state (`is_logged_in: false`).

2. **Login**: `handle_login()` spawns a background thread. `start_browser_login()` opens a browser and returns. The background thread waits for the OAuth callback, then writes `UiUpdate::AuthSuccess { profile }` to shared state.

3. **Polling**: `Render::render()` calls `poll_updates()`, which takes the update from shared state and applies it to the view's fields.

4. **Logout**: The view directly sets `is_logged_in = false` without going through shared state (no backend call needed).

## Instance State Management

Instance state is entirely filesystem-based:

- `InstanceManager::list()` scans the `instances/` directory and reads each `instance.toml`
- `InstanceManager::create()` generates a slug-based ID with a hash suffix, creates directories, and writes `instance.toml`
- `InstanceManager::delete()` removes the entire instance directory

Each instance has an isolated directory structure:

```
{data_dir}/instances/{instance-id}/
├── instance.toml          (InstanceConfig)
├── mods/                  (downloaded .jar files)
└── .minecraft/            (game files managed by mc-launcher-core)
```

## Future: Full Command/Update Bridge

The current prototype runs auth inline on background threads. A full migration will restore the MPSC bridge:

```
View (main thread) ──[BackendCommand]──► Command dispatcher (background thread)
                                                │
View (main thread) ◄──[UiUpdate]────── Progress/task results
```

This separation allows:
- Centralized command dispatch with proper error handling
- Guaranteed event delivery (MPSC vs. overwrite-on-latest)
- Multiple concurrent updates (progress bars, status messages)
- Clean shutdown via channel drop
