# Vesper Launcher - Development Guide

## Quick Start

### Prerequisites
- Rust 1.75+ with stable toolchain
- OpenSSL (for reqwest with rustls-tls)
- CMake (for some native dependencies)
- Protocol Buffer compiler

### Building

```bash
cd /path/to/vesper-launcher

# Build all crates
cargo build --release

# Or build individually
cargo build -p vesper-ui --release
cargo build -p vesper-daemon --release
cargo build -p vesper-supervisor --release
```

### Running

```bash
# Start supervisor (recommended)
./target/release/vesper-supervisor

# Or start directly
./target/release/vesper-daemon &
./target/release/vesper-ui
```

## Architecture Overview

- **UI Process**: Uses eframe/egui for rendering
- **Daemon Process**: gRPC server managing all background operations
- **Supervisor Process**: Auto-restarts daemon on crash

## Key Commands

```bash
# Check formatting
cargo fmt --all

# Run lints
cargo clippy --all

# Run tests
cargo test --all

# Build with all features
cargo build --all-features
```

## Crate Structure

| Crate | Purpose |
|-------|---------|
| vesper-core | Shared types, domain models |
| vesper-proto | gRPC service definitions |
| vesper-ui | eframe/egui application |
| vesper-daemon | Background service |
| vesper-supervisor | Process supervisor |
| vesper-download | Download subsystem |
| vesper-auth | Authentication |
| vesper-git | Git operations |
| vesper-update | Update system |

## Development Notes

- Use `tracing` for logging
- gRPC runs on `127.0.0.1:50051`
- Instance storage: `~/.local/share/vesper/instances/`
- Global cache: `~/.cache/vesper/`