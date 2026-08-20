# Filesystem Layout

Vesper Client uses the `directories` crate (v6) for cross-platform OS-standard paths, ensuring instance sandboxing and config isolation across Windows, macOS, and Linux.

## directories Crate Usage

All paths are derived from `ProjectDirs::from("", "VOMLabs", "VesperClient")`:

```rust
pub fn project_dirs() -> CoreResult<ProjectDirs> {
    ProjectDirs::from("", "VOMLabs", "VesperClient")
        .ok_or_else(|| CoreError::Setup("Failed to determine project directories".into()))
}
```

## Platform-Specific Data Paths

| Platform | Path |
|---|---|
| Linux | `~/.local/share/VesperClient/` |
| macOS | `~/Library/Application Support/com.VOMLabs.VesperClient/` |
| Windows | `C:\Users\{user}\AppData\Roaming\VOMLabs\VesperClient\data\` |

## Data Directory Structure

```
{data_dir}/
├── vesper_config.toml           (global VesperConfig)
├── logs/                        (game and launcher logs)
├── bedrock/                     (Bedrock Edition game data)
└── instances/
    ├── {instance-id}/
    │   ├── instance.toml        (InstanceConfig)
    │   ├── mods/                (downloaded .jar mod files)
    │   └── .minecraft/          (game files managed by mc-launcher-core)
    │       ├── versions/
    │       ├── assets/
    │       ├── libraries/
    │       └── ...
    └── {instance-id}/
        └── ...
```

## Directory Accessor Functions

```rust
// Base data directory (creates if missing)
pub fn data_dir() -> CoreResult<PathBuf> {
    let dir = project_dirs()?.data_dir().to_path_buf();
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

// Global config file path
pub fn config_path() -> CoreResult<PathBuf> {
    Ok(data_dir()?.join("vesper_config.toml"))
}

// Instances root directory (creates if missing)
pub fn instances_dir() -> CoreResult<PathBuf> {
    let dir = data_dir()?.join("instances");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

// Logs directory (creates if missing)
pub fn logs_dir() -> CoreResult<PathBuf> {
    let dir = data_dir()?.join("logs");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}
```

## Instance Sandboxing

Each instance is fully isolated. The `InstanceManager` provides path accessors:

```rust
impl InstanceManager {
    // Root directory for an instance
    pub fn instance_dir(&self, id: &str) -> PathBuf {
        self.base_dir.join(id)
    }

    // .minecraft directory (game files)
    pub fn minecraft_dir(&self, id: &str) -> PathBuf {
        self.base_dir.join(id).join(".minecraft")
    }

    // mods directory (user-installed mods)
    pub fn mods_dir(&self, id: &str) -> PathBuf {
        self.base_dir.join(id).join("mods")
    }
}
```

Mods downloaded via Modrinth/CurseForge are placed in `{instance}/mods/`. The game files (versions, assets, libraries) are placed in `{instance}/.minecraft/` by `mc-launcher-core`.

## Config File Locations

### vesper_config.toml

Location: `{data_dir}/vesper_config.toml`

```toml
# Profiles stored as TOML arrays
[[profiles]]
id = "abc123"
display_name = "Steve"
account_type = "Java"
minecraft_username = "Steve"
minecraft_uuid = "abc-123"

[active_profile_id]
Some = "abc123"

[java_path]
Some = "/usr/lib/jvm/java-17/bin/java"

max_memory_mb = 4096

[jvm_args]
Some = "-XX:+UseG1GC"

window_width = 1100
window_height = 700
```

### instance.toml

Location: `{data_dir}/instances/{id}/instance.toml`

```toml
name = "My Survival World"
mc_version = "1.21.50"
loader_type = "Fabric"
loader_version = "0.16.10"
created_at = "1724160000"

[last_played]
Some = "1724246400"
```

## Bedrock Game Data

Bedrock Edition uses a separate `bedrock/` directory under the data root:

```rust
let game_dir = directories::ProjectDirs::from("", "", "Vesper Client")
    .map(|d| d.data_dir().join("bedrock").to_string_lossy().to_string())
    .unwrap_or_else(|| "~/.local/share/vesper-client/bedrock".into());
```

This directory is passed to `mcpelauncher-client` via the `-dg` flag.
