# Backend Guide

## Rust Structure (src-tauri/)

```
src-tauri/src/
├── commands/       # Tauri command handlers
│   ├── auth.rs     # Microsoft OAuth authentication
│   ├── instance.rs # Instance CRUD and launch operations
│   └── mod.rs      # Re-exports
├── models/         # Data models (serde)
│   ├── mod.rs
│   └── modrinth.rs # Modrinth API response models
├── services/       # Business logic
│   ├── downloader.rs   # File downloads
│   ├── mod_resolver.rs # Mod version resolution (e.g., Sodium)
│   └── mod.rs
├── error.rs        # AppError enum
├── lib.rs          # Module entry point, Tauri builder setup
├── main.rs         # Application entry point
└── secure_storage.rs # Encrypted token storage
```

## Tauri Commands

Commands are registered in `lib.rs` using `tauri::generate_handler!`. Each command handler lives in `commands/` and is async.

### Available Commands

| Command | File | Purpose |
|---|---|---|
| `load_app_state` | instance.rs | Load persisted application state |
| `save_app_state` | instance.rs | Save application state |
| `list_instances` | instance.rs | List all Minecraft instances |
| `create_instance` | instance.rs | Create a new instance |
| `launch_instance` | instance.rs | Launch an instance |
| `discover_search_modrinth` | instance.rs | Search Modrinth (native) |
| `discover_download_modrinth` | instance.rs | Download mod from Modrinth |
| `auth_get_status` | auth.rs | Get auth status |
| `auth_begin_microsoft_device_login` | auth.rs | Start Microsoft device login |
| `auth_poll_microsoft_device_login` | auth.rs | Poll for login completion |
| `auth_logout_microsoft` | auth.rs | Log out Microsoft account |

## Services

### Mod Resolver (`services/mod_resolver.rs`)

Resolves the correct Sodium mod version for a given Minecraft version and loader. Calls `api.modrinth.com/v2/project/sodium/version` with game version and loader filters.

### Downloader (`services/downloader.rs`)

Downloads files from URLs using `reqwest`. Errors are mapped to `AppError::ModrinthApi`.

## Error Handling

All errors use the `AppError` enum (defined in `error.rs`):

```rust
pub enum AppError {
    ModrinthApi(reqwest::Error),
    NoSodiumVersion,
    Download(String),
    Io(std::io::Error),
    Serde(serde_json::Error),
    // ...
}
```

## Dependencies

- `reqwest` — HTTP client
- `serde` / `serde_json` — Serialization
- `tauri` v2 — Desktop framework
- `tauri-plugin-shell` — Shell access for launching Minecraft
