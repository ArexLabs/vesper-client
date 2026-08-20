# Development Setup

## Rust Toolchain Requirements

- **Minimum**: Rust 1.75+ (edition 2021)
- **Recommended**: Latest stable toolchain via `rustup`
- **Workspace**: Cargo workspace with `resolver = "2"`

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Update to latest stable
rustup update stable

# Verify
rustc --version
cargo --version
```

## Platform-Specific Dependencies

### Linux (Ubuntu/Debian)

```bash
# Slint requires these for native rendering
sudo apt install -y \
    libfontconfig1-dev \
    libxcb-shape0-dev \
    libxcb-xfixes0-dev \
    libxcb-render0-dev \
    libxcb1-dev \
    libxkbcommon-dev \
    libwayland-dev

# For OpenSSL (reqwest)
sudo apt install -y libssl-dev pkg-config
```

### Linux (Fedora)

```bash
sudo dnf install -y \
    fontconfig-devel \
    libxcb-devel \
    libxkbcommon-devel \
    wayland-devel \
    openssl-devel \
    pkg-config
```

### macOS

```bash
# Xcode command line tools
xcode-select --install

# No additional dependencies required for Slint on macOS
```

### Windows

- Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with "Desktop development with C++" workload
- Slint uses Direct3D on Windows (no additional libs needed)

## Build Configuration

The project uses a Cargo workspace:

```toml
# Workspace Cargo.toml
[workspace]
members = ["vesper-core", "vesper-client"]
resolver = "2"
```

### vesper-core (library)

Contains all domain logic. Key dependencies:

```toml
[dependencies]
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", features = ["json", "stream"] }
mc-launcher-core = "0.1"
minecraft-msa-auth = "0.4"
oauth2 = { version = "5", features = ["reqwest"] }
ferinth = "2"
furse = "1"
futures-util = "0.3"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
toml = "0.8"
directories = "6"
sysinfo = "0.35"
thiserror = "2"
tracing = "0.1"
```

### vesper-client (binary)

Contains the Slint UI and main entry point:

```toml
[dependencies]
vesper-core = { path = "../vesper-core" }
slint = "1.17"
tokio = { version = "1", features = ["full"] }
anyhow = "1"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter", "fmt"] }

[build-dependencies]
slint-build = "1.17"
```

The UI is compiled at build time via `build.rs`:

```rust
fn main() {
    slint_build::compile("src/ui/app.slint").unwrap();
}
```

## Build Commands

```bash
# Debug build
cargo build

# Release build
cargo build --release

# Check without building
cargo check

# Run
cargo run --release

# Run tests
cargo test
```

## IDE Setup Recommendations

### VS Code

Recommended extensions:
- **rust-analyzer** - Rust language server
- **CodeLLDB** - Debugging support

Settings (`.vscode/settings.json`):
```json
{
    "rust-analyzer.check.command": "clippy",
    "rust-analyzer.cargo.features": []
}
```

### RustRover / IntelliJ

Native Rust support is built-in. Open the workspace root directory.

## CurseForge API Key (Optional)

CurseForge integration requires an API key. To enable it:

1. Request an API key from [CurseForge](https://support.curseforge.com/en/support/solutions/articles/9000208346-curseforge-api)
2. The key is passed to `ModManager::new()` as `curseforge_api_key`
3. Without a key, CurseForge features return an error and Modrinth remains functional
