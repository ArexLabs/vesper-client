# Development Setup

## Rust Toolchain Requirements

- **Minimum**: Rust 1.82+ (edition 2021, pinned via `mise`)
- **Toolchain Manager**: [mise](https://mise.jdx.dev/) (reads `mise.toml`)
- **Workspace**: Cargo workspace with `resolver = "2"`

```bash
# Install mise
curl https://mise.run | sh

# Install project toolchain (Rust 1.82.0, just, cargo-binstall, etc.)
mise install

# Verify
rustc --version
cargo --version
just --version
```

## Platform-Specific Dependencies

### Linux (Ubuntu/Debian)

```bash
# GPUI requires these for GPU-accelerated rendering
sudo apt install -y \
    libfontconfig1-dev \
    libxkbcommon-dev \
    libwayland-dev \
    libvulkan-dev \
    libssl-dev \
    pkg-config \
    cmake

# Optional: for clipboard support (arboard)
sudo apt install -y libxcb-shape0-dev libxcb-xfixes0-dev libxcb-render0-dev libxcb1-dev
```

### Linux (Fedora)

```bash
sudo dnf install -y \
    fontconfig-devel \
    libxkbcommon-devel \
    wayland-devel \
    vulkan-devel \
    openssl-devel \
    pkg-config \
    cmake
```

### macOS

```bash
# Xcode command line tools
xcode-select --install

# GPUI uses Metal on macOS — no additional dependencies needed
```

### Windows

- Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with "Desktop development with C++" workload
- GPUI uses Direct3D on Windows (no additional libs needed)

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

Contains the GPUI native UI and main entry point:

```toml
[dependencies]
vesper-core = { path = "../vesper-core" }
gpui = "0.2.2"
tokio = { version = "1", features = ["full"] }
directories = "6"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter", "fmt"] }
arboard = "3"
open = "5"
```

The UI is pure Rust — no build script needed. Views are GPUI entities that implement the `Render` trait.

## Build Commands

```bash
# Using just (recommended)
just check          # cargo check (fast)
just test           # cargo test
just build          # cargo build --release
just run            # cargo run --release
just clippy         # cargo clippy --all-features
just format         # cargo fmt
just all            # check + test + clippy + build

# Using cargo directly
cargo check
cargo build --release
cargo test
cargo run --release
```

## IDE Setup Recommendations

### VS Code

Recommended extensions:
- **rust-analyzer** — Rust language server
- **CodeLLDB** — Debugging support

Settings (`.vscode/settings.json`):
```json
{
    "rust-analyzer.check.command": "clippy",
    "rust-analyzer.cargo.features": []
}
```

### RustRover / IntelliJ

Native Rust support is built-in. Open the workspace root directory.

## GPUI Development Notes

GPUI 0.2.2 is a pre-1.0 framework from the Zed editor project. Key points:

- **No built-in Button widget** — buttons are built from `div()` + `.on_click()` + `.hover()`
- **Tailwind-style API** — `.flex().flex_col().items_center().gap_4().bg().rounded_2xl()`
- **Views are entities** — created with `cx.new(|cx| MyView { ... })`, stored as `Entity<MyView>`
- **Event handling** — `cx.listener(|this, event, window, cx| { ... })` for click handlers
- **Conditional rendering** — `.when(condition, |el| el.child(...))`
- **Theme** — use `gpui::rgb()` for colors (see `ui/theme.rs`)
- **Learn from Zed source** — the best reference for GPUI patterns is the Zed codebase itself

## CurseForge API Key (Optional)

CurseForge integration requires an API key. To enable it:

1. Request an API key from [CurseForge](https://support.curseforge.com/en/support/solutions/articles/9000208346-curseforge-api)
2. The key is passed to `ModManager::new()` as `curseforge_api_key`
3. Without a key, CurseForge features return an error and Modrinth remains functional
