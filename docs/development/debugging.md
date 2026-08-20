# Debugging

## Logging Configuration

Vesper Client uses `tracing` with `tracing-subscriber` for structured logging. The subscriber is initialized in `main()`:

```rust
tracing_subscriber::fmt()
    .with_env_filter(
        tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
    )
    .with_target(false)
    .init();
```

Default log level is `info`. Override via the `RUST_LOG` environment variable.

## RUST_LOG Examples

```bash
# Default (info and above)
cargo run

# Debug everything
RUST_LOG=debug cargo run

# Trace auth module only
RUST_LOG=vesper_core::auth=trace cargo run

# Debug auth and info for everything else
RUST_LOG=vesper_core::auth=debug,info cargo run

# Trace everything
RUST_LOG=trace cargo run

# Suppress all logs except errors
RUST_LOG=error cargo run

# Module-specific logging
RUST_LOG=vesper_core::launcher=debug cargo run
RUST_LOG=vesper_core::mods=debug cargo run
RUST_LOG=vesper_core::instances=debug cargo run
```

## tracing-subscriber Setup

The subscriber is configured with:
- `EnvFilter` - reads `RUST_LOG` env var
- `with_target(false)` - suppresses module path in output for cleaner logs
- Default level: `info`

Log output format:
```
2024-08-20T12:00:00.000Z  INFO Vesper Client starting up
2024-08-20T12:00:00.100Z  INFO [auth] Starting Xbox Live authentication...
2024-08-20T12:00:00.200Z  INFO [auth] Xbox Live auth OK, starting XSTS...
```

## Common Debugging Scenarios

### Auth Flow Issues

```bash
# Enable full auth trace logging
RUST_LOG=vesper_core::auth=trace cargo run
```

Auth logs include:
- `[auth] Starting Xbox Live authentication...`
- `[auth] Xbox Live auth OK, starting XSTS...`
- `[auth] XSTS auth OK, logging into Minecraft...`
- `[auth] MC login OK, fetching profile...`
- `[auth] MC profile fetched: {username}`

Bedrock auth logs:
- `[bedrock] Device auth OK, device_id=...`
- `[bedrock] SISU authorize OK, user_hash=...`
- `[bedrock] Cert chain retrieved (N elements)`
- `[bedrock] PlayFab login OK`
- `[bedrock] Session start OK`
- `[bedrock] Multiplayer session OK`
- `[bedrock] Full auth chain completed for {name}`

### Instance Operations

```bash
RUST_LOG=vesper_core::instances=debug cargo run
```

### Mod Downloads

```bash
RUST_LOG=vesper_core::mods=debug cargo run
```

### Launch Issues

```bash
RUST_LOG=vesper_core::launcher=debug cargo run
```

Launch logs include:
- The full Java command and arguments
- Working directory path
- Process ID on successful launch

### Config Loading

Failed config loads fall back to defaults:
```
WARN Failed to load config, using defaults: {error}
```

## Performance Profiling

### Install Timing

Add timing around the install call:

```bash
RUST_LOG=vesper_core::launcher=debug cargo run 2>&1 | tee debug.log
```

The `UiProgressReporter` logs stage transitions and task completion.

### Memory Usage

```bash
# Linux
RUST_LOG=debug cargo run &
PID=$!
watch -n 1 "ps -o pid,rss,comm -p $PID"

# macOS
RUST_LOG=debug cargo run &
PID=$!
while kill -0 $PID 2>/dev/null; do ps -o pid,rss,comm -p $PID; sleep 1; done
```

### Network Debugging

For HTTP request debugging, enable reqwest-level tracing:

```bash
RUST_LOG=vesper_core=trace,reqwest=trace cargo run
```

### Tokio Console

For async task inspection, enable the tokio-console feature (development only):

```bash
# In Cargo.toml, add to tokio features:
tokio = { version = "1", features = ["full", "tracing"] }

# Then run with:
RUST_LOG=tokio=trace cargo run
```

## Common Issues

### Slint Compilation Error

If `build.rs` fails to compile `app.slint`, ensure the Slint DSL file exists at `vesper-client/src/ui/app.slint`. This file is generated or must be present before building.

### Port Binding Failures

Browser login binds to `127.0.0.1:0` (OS-assigned port). If this fails:
- Check no antivirus is blocking local loopback connections
- Verify the port is not in use by another process

### mc-launcher-core Panics

The install and launch operations run inside `spawn_blocking`. If they panic, the error is caught:

```rust
.map_err(|e| CoreError::Launcher(format!("Install task panicked: {e}")))?
```

Check logs for the underlying error message.

### CurseForge "API key not configured"

This is expected without a CurseForge API key. Modrinth search remains functional.
