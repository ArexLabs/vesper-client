# Bridge Architecture: Tokio <-> Slint

The Vesper Client uses a two-thread architecture where the Slint event loop runs on the main thread and the Tokio async runtime runs on a dedicated OS thread. Communication between them uses two unbounded MPSC channels.

## Threading Model

```
┌──────────────────────────────┐     ┌──────────────────────────────────┐
│  Main Thread (Slint)         │     │  OS Thread (Tokio Runtime)       │
│                              │     │                                  │
│  tracing_subscriber::init()  │     │  Builder::new_multi_thread()     │
│  VesperConfig::load()        │     │    .enable_all()                 │
│  AppWindow::new()            │     │    .build()                      │
│                              │     │                                  │
│  setup_ui_callbacks(ui, cmd) │     │  InstanceManager::new()          │
│    │                         │     │  AuthManager::new(client_id)     │
│    ▼                         │     │  ModManager::new(...)            │
│  ui.run() ───────────────────┼─────┤                                  │
│                              │     │  while let Some(cmd) =           │
│  on_*_callback()             │     │    cmd_rx.recv().await {         │
│    │                         │     │    tokio::spawn(                 │
│    ▼                         │     │      handle_command(cmd, ...)     │
│  cmd_tx.send(cmd) ───────────┼────►│    )                             │
│                              │     │  }                               │
│  spawn_local:                │     │                                  │
│    while let Some(update) =  │     │    update_tx.send(UiUpdate) ─────┼──┐
│      update_rx.recv() {      │     │                                  │  │
│      upgrade_in_event_loop() │     └──────────────────────────────────┘  │
│        apply_ui_update()     │                                          │
│    }                         │◄─────────────────────────────────────────┘
│                              │
│  ui.run() returns            │
│  drop(cmd_tx)                │
│  backend_handle.join()       │
└──────────────────────────────┘
```

## Channel Types

```rust
// UI -> Backend: structured commands from Slint callbacks
let (cmd_tx, cmd_rx) = mpsc::unbounded_channel::<BackendCommand>();

// Backend -> UI: status updates, progress, results
let (update_tx, update_rx) = mpsc::unbounded_channel::<UiUpdate>();
```

Both channels use `tokio::sync::mpsc::unbounded_channel`. Unbounded channels are used because the UI thread is synchronous and must never block waiting for channel capacity.

## BackendCommand

Commands sent from the UI to the Tokio runtime. Each command is an independent variant that maps to a specific user action.

```rust
pub enum BackendCommand {
    AuthStartBrowserLogin { account_type: String },
    AuthRefreshToken,
    AuthLogout,
    AuthGetStatus,

    InstanceCreate { name, mc_version, loader: LoaderType, loader_version },
    InstanceList,
    InstanceDelete { id },

    ModSearch { query, source: ModSource },
    ModDownload { instance_id, project_id, file_id, file_name, source },
    ModListInstalled { instance_id },

    LaunchInstall { instance_id },
    LaunchStart { instance_id },

    BedrockLaunch { profile_id },
    BedrockDetectLauncher,
}
```

### Command Dispatch

Each command is spawned as an independent Tokio task, allowing concurrent processing:

```rust
while let Some(cmd) = cmd_rx.recv().await {
    let update_tx = update_tx.clone();
    // clone Arc references...
    tokio::spawn(async move {
        handle_command(cmd, &update_tx, &instance_manager, &auth_manager, &mod_manager).await;
    });
}
```

The `handle_command` function pattern-matches on the command variant and dispatches to the appropriate domain function. Errors are sent back as `UiUpdate` error variants.

## UiUpdate

Updates sent from backend tasks to the UI. Applied via `slint::spawn_local` and `upgrade_in_event_loop`.

```rust
pub enum UiUpdate {
    // Auth
    AuthBrowserLoginStarted,
    AuthSuccess { profile: AuthProfile },
    AuthError { message: String },
    AuthLoggedOut,
    AuthStatus { is_logged_in: bool, profile: Option<AuthProfile> },

    // Instances
    InstanceListResult(Vec<InstanceInfo>),
    InstanceCreated { id, name },
    InstanceDeleted { id },
    InstanceError { message: String },

    // Mods
    ModSearchResults(Vec<ModInfo>),
    ModDownloadProgress { project_name, progress: f32 },
    ModDownloadComplete { project_name },
    ModListResult(Vec<InstalledModInfo>),
    ModError { message: String },

    // Install / Launch
    InstallProgress { stage: String, progress: f32 },
    InstallComplete,
    LaunchStarted,
    LaunchError { message: String },

    // Bedrock
    BedrockLauncherFound { path },
    BedrockLauncherNotFound,
    BedrockLaunched,
    BedrockLaunchError { message: String },

    // System
    SystemMessage { text: String },
}
```

### UI Update Application

```rust
slint::spawn_local(async move {
    while let Some(update) = update_rx.recv().await {
        let ui_weak = ui_weak.clone();
        let _ = ui_weak.upgrade_in_event_loop(move |ui| {
            apply_ui_update(&ui, update);
        });
    }
});
```

`apply_ui_update` pattern-matches on each variant and sets Slint UI properties accordingly (e.g., `ui.set_is_logged_in(true)`, `ui.set_instances(...)`).

## Error Propagation Across the Bridge

Errors flow back to the UI through `UiUpdate` variants:

```rust
// In handle_command:
match instance_manager.create(&name, &mc_version, loader, loader_version) {
    Ok(info) => {
        let _ = update_tx.send(UiUpdate::InstanceCreated { id: info.id, name: info.config.name });
    }
    Err(e) => {
        let _ = update_tx.send(UiUpdate::InstanceError { message: e.to_string() });
    }
}
```

The UI thread never receives raw `CoreError` values. All errors are converted to `String` messages inside `UiUpdate` error variants before crossing the bridge. The `apply_ui_update` function handles these by logging via `tracing::error!` and optionally displaying them in the UI.

## UI Callback Registration

Callbacks are registered in `setup_ui_callbacks`, where each Slint callback sends a `BackendCommand` through the channel:

```rust
fn setup_ui_callbacks(ui: &AppWindow, cmd_tx: &mpsc::UnboundedSender<BackendCommand>) {
    let tx = cmd_tx.clone();
    ui.on_login_requested(move |account_type| {
        let _ = tx.send(BackendCommand::AuthStartBrowserLogin {
            account_type: account_type.to_string(),
        });
    });

    let tx = cmd_tx.clone();
    ui.on_instance_create_requested(move |name, mc_version, loader, loader_version| {
        let loader_type = LoaderType::from_str_loose(&loader);
        let _ = tx.send(BackendCommand::InstanceCreate { ... });
    });
    // ... more callbacks
}
```

## Shutdown

When `ui.run()` returns (user closes the window), the main thread drops both channel senders. The Tokio runtime's `cmd_rx.recv()` returns `None`, the `while let` loop exits, and `block_on` completes. The OS thread is then joined via `backend_handle.join()`.
