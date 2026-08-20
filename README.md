# Vesper Client

A modern, lightweight, isolated multi-version Minecraft launcher built for VOMLabs.

## Tech Stack

| Category | Technology | Purpose |
|---|---|---|
| UI Framework | Slint 1.17 | Hardware-accelerated native UI via DSL |
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
| Error Handling | thiserror 2.x, anyhow 1.x | Domain errors (thiserror), UI boundary (anyhow) |
| Logging | tracing, tracing-subscriber | Structured async logging with env-filter |

## Architecture

```
vesper-client/
├── Cargo.toml              (workspace root, resolver = "2")
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
└── vesper-client/          (binary crate — Slint UI)
    ├── Cargo.toml
    ├── build.rs             (compiles app.slint)
    └── src/
        ├── main.rs           main(), setup_ui_callbacks(), handle_command()
        └── ui/mod.rs         placeholder for Rust-side UI utilities
```

### Bridge Diagram (Tokio <-> Slint)

```
┌──────────────────────┐     ┌──────────────────────────┐
│  Main Thread (Slint)  │     │ OS Thread (Tokio Runtime) │
│                       │     │                           │
│  ui.run()             │     │  rt.block_on(async {      │
│    │                  │     │    while let Some(cmd) =   │
│  on_*_callback        │     │      cmd_rx.recv().await { │
│    │                  │     │      tokio::spawn(         │
│    ▼                  │     │        handle_command()    │
│  cmd_tx.send()  ──────┼────►│      )                    │
│                       │     │    }                       │
│  update_rx      ◄─────┼─────┤    update_tx.send() ──────┤
│    │                  │     │                           │
│    ▼                  │     └──────────────────────────┘
│  apply_ui_update()    │
└──────────────────────┘
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

- Rust 1.75+ (edition 2021)
- Linux: wayland-dev or X11 dev libs, fontconfig, OpenSSL
- macOS: Xcode command line tools
- Windows: MSVC build tools

## Building

```bash
git clone https://github.com/VOMLabs/vesper-client.git
cd vesper-client

# Build in release mode
cargo build --release

# Run the launcher
cargo run --release
```

## Development

```bash
# Check for compile errors without full build
cargo check

# Run tests
cargo test

# Run with debug logging
RUST_LOG=debug cargo run

# Run with specific module logging
RUST_LOG=vesper_core::auth=trace cargo run
```

## License

This project is licensed under the MIT License. See the LICENSE file for details.
