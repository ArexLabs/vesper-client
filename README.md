# Vesper Client

A modern, lightweight, isolated multi-version Minecraft launcher built for VOMLabs.

> **⚠️ WARNING: Active Migration In Progress**
>
> This project is currently undergoing a major UI framework migration from Slint to GPUI.
> **This software is NOT secure and should NOT be used in production.**
> Only the Login page prototype has been migrated so far. The full UI migration
> is actively being worked on. See `MIGRATION_PLAN.md` for details.

## Tech Stack

| Category | Technology | Purpose |
|---|---|---|
| UI Framework | GPUI 0.2.2 | GPU-accelerated Rust-native UI framework (Zed editor's UI layer) |
| Async Runtime | Tokio 1.x | Background thread pool, async I/O, network workers |
| HTTP Client | reqwest 0.12 | Async HTTP for APIs, manifests, and downloads |
| Minecraft Core | mc-launcher-core 0.1 | Vanilla/Fabric/NeoForge install, asset resolution, launch |
| MS Auth | minecraft-msa-auth 0.4 + oauth2 5.x | Microsoft OAuth2 device code + browser login |
| Modrinth API | ferinth 2.x | Typed Modrinth API client |
| CurseForge API | furse 1.x | Typed CurseForge API client |
| Concurrent Downloads | futures-util 0.3 | Bounded parallel download pipeline |
| Serialization | serde, serde_json, toml | JSON manifests, TOML configs |
| Filesystem | directories 6.x | Cross-platform OS storage paths |
| System Info | sysinfo 0.35 | Memory detection for Java heap sizing |
| Error Handling | thiserror 2.x | Domain errors |
| Logging | tracing, tracing-subscriber | Structured async logging with env-filter |

## Architecture

```
vesper-client/
├── Cargo.toml              (workspace root, resolver = "2")
├── justfile                 (20 task recipes)
├── mise.toml                (Rust 1.82.0 pinned, tools, env)
│
├── vesper-core/            (library crate — all domain logic)
│   └── src/
│       ├── lib.rs
│       ├── error.rs          CoreError, CoreResult
│       ├── bridge/           BackendCommand, UiUpdate, channel types
│       ├── auth/             AuthManager, BedrockAuthManager, keys, tokens
│       ├── config/           VesperConfig, InstanceConfig, platform paths
│       ├── instances/        InstanceManager (CRUD, filesystem)
│       ├── launcher/         GameInstaller, ProgressUpdate, launch command
│       └── mods/             ModManager, ModrinthClient, CurseForgeClient
│
└── vesper-client/          (binary crate — GPUI native UI)
    ├── Cargo.toml
    └── src/
        ├── main.rs           GPUI Application lifecycle, window creation
        └── ui/
            ├── mod.rs          module exports
            ├── login_view.rs   Login page (GPUI Render entity)
            ├── instances_view.rs  Instances page (planned)
            ├── mods_view.rs    Mods page (planned)
            ├── settings_view.rs   Settings page (planned)
            ├── sidebar.rs      Navigation sidebar (planned)
            ├── theme.rs        Catppuccin Mocha color tokens
            └── components/     Reusable UI components (planned)
```

### GPUI Threading Model

GPUI runs on the main thread with an event loop. Async work must be offloaded
to a dedicated background thread:

```
┌──────────────────────────┐     ┌──────────────────────────────┐
│  Main Thread (GPUI)       │     │  Background Thread            │
│                            │     │  (tokio Runtime)              │
│  Application::new()        │     │                                │
│    .run(|cx| {             │     │  rt.block_on(async {           │
│      cx.open_window(...)   │     │    // auth, install, mods      │
│    })                      │     │    Arc<Mutex<Option<UiUpdate>>> │
│                            │◄────│      shared state              │
│  cx.spawn(async {          │     │  })                            │
│    poll_updates()          │     │                                │
│  })                        │     └──────────────────────────────┘
│                            │
│  Render::render()          │     Each view checks shared state
│    .poll_updates()         │     and updates its fields accordingly.
└──────────────────────────┘
```

Auth, install, and mod operations run on a dedicated OS thread with its own
tokio runtime. This works around GPUI 0.2.2's `AsyncFnOnce` lifetime
constraints and domain managers being `!Send`.

### Shared State Pattern

Views use `Arc<Mutex<Option<UiUpdate>>>` for cross-thread communication.
Background work writes updates; the render loop polls and consumes them:

```rust
// Background thread writes:
*guard = Some(UiUpdate::AuthSuccess { profile });

// Main thread polls (in Render::render):
if let Some(update) = guard.take() {
    // apply state changes
}
```

## Features

- Multi-version Minecraft instance management (Vanilla, Fabric, NeoForge)
- Microsoft OAuth2 browser login (Java Edition)
- Bedrock Edition authentication chain (device auth, SISU, cert chain, PlayFab)
- Modrinth and CurseForge mod search and download
- Concurrent mod downloads (bounded to 4 simultaneous)
- Cross-platform filesystem isolation via `directories` crate
- Dynamic Java memory detection via `sysinfo`
- Structured logging with `tracing`

## Prerequisites

- Rust 1.82+ (edition 2021, pinned via `mise`)
- Linux: wayland-dev or X11 dev libs, fontconfig, OpenSSL, libxkbcommon, vulkan-loader
- macOS: Xcode command line tools
- Windows: MSVC build tools

## Building

```bash
git clone https://github.com/VOMLabs/vesper-client.git
cd vesper-client

# Install toolchain (requires mise)
mise install

# Build in release mode
cargo build --release

# Run the launcher
cargo run --release
```

## Development

```bash
# Use just for common tasks
just check          # cargo check (fast)
just test           # cargo test
just build          # cargo build --release
just run            # cargo run --release
just clippy         # lint
just format         # fmt
just all            # check + test + clippy + build

# Run with debug logging
RUST_LOG=debug cargo run

# Run with specific module logging
RUST_LOG=vesper_core::auth=trace cargo run
```

## License

This project is licensed under the MIT License. See the LICENSE file for details.
