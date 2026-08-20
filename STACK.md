# Technology Stack - Vesper Client

This document outlines the complete technical stack, architectural boundaries, and crate dependencies utilized in the Vesper Client MVP. A modern, lightweight, isolated multi-version Minecraft launcher for VOMLabs.

---

## Workspace Structure

The project is a Cargo workspace with two crates:

- **`vesper-core`** — Library crate containing all domain logic: auth, instance management, mod downloading, launcher integration, config, and the UI-bridge layer.
- **`vesper-client`** — Binary crate containing the GPUI native UI screens, main entry point, and Tokio-async bridge wiring.

```
vesper-client/            (workspace root)
├── vesper-core/          (library)
└── vesper-client/        (binary — GPUI)
```

---

## Core Architecture Components

| Category             | Component / Crate | Purpose in Vesper Client                                                                                                 |
| -------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **User Interface**   | `gpui`            | GPU-accelerated native UI framework (from Zed editor). Pure Rust, no DSL. Renders via wgpu with Tailwind-style API.      |
| **Async Runtime**    | `tokio`           | Driving the non-blocking background thread pool, async I/O tasks, and network worker processes.                          |
| **Networking**       | `reqwest`         | Async HTTP client for fetching game manifests, API communication, and downloading assets.                                |

---

## Minecraft Domain Logic

- **`mc-launcher-core`** (v0.1.1): The structural backbone for installing vanilla profiles, resolving Fabric/NeoForge dependencies, extracting native libraries, and building the final platform-compliant Java execution strings. Handles asset integrity verification internally.
- **`minecraft-msa-auth`** (v0.4.0): Simplifies the multi-step Microsoft OAuth authentication process (Microsoft Exchange -> Xbox Live -> XSTS -> Mojang token acquisition).
- **`oauth2`** (v5): Provides the OAuth 2.0 device code flow implementation for Microsoft identity endpoints, paired with `minecraft-msa-auth` for the Minecraft token exchange chain.

---

## Modding Ecosystem Integrations

- **`ferinth`**: Strongly-typed client wrapper providing native API interaction with the Modrinth ecosystem to search and fetch mods.
- **`furse`**: Client wrapper supplying programmatic access to the CurseForge API for legacy and exclusive mod distributions.
- **`futures-util`**: Used to implement concurrent download pipelines (`StreamExt`), allowing bounded parallel mod downloads (max 4 concurrent streams).

---

## Data, State & Serialization

- **`serde` & `serde_json`**: Frameworks for parsing dynamic, deeply nested JSON manifests from Mojang, Fabric, and NeoForge metadata endpoints.
- **`toml`**: Handles human-readable serialization and parsing for global settings (`vesper_config.toml`) and sandboxed instance configs (`instance.toml`).

---

## Filesystem & Hardware Awareness

- **`directories`**: Provides cross-platform abstraction for standard OS storage paths via `ProjectDirs`, guaranteeing true instance sandboxing across Windows, macOS, and Linux.
- **`sysinfo`**: Queries runtime hardware memory capacity to dynamically compute safe Java allocation arguments (`-Xmx`).

---

## Bridge Architecture (GPUI <-> Tokio)

The UI runs on GPUI's main thread event loop. Async work (auth, installs, downloads) runs on dedicated background threads with their own tokio runtimes.

Communication uses two patterns:

- **`Arc<Mutex<Option<UiUpdate>>>`**: Shared state for one-shot async results (auth success/error, status updates). Background threads write; GPUI views poll in `Render::render()`.
- **`mpsc::channel<BackendCommand>`**: MPSC channel reserved for future command dispatch (currently auth runs inline on background threads).

The background thread uses `tokio::runtime::Builder::new_current_thread().enable_all().build()` + `block_on()`. GPUI runs on the main thread via `Application::new().run()`.

### Why Not MPSC for Everything?

GPUI 0.2.2's `cx.spawn()` requires `AsyncFnOnce` with lifetime bounds that prevent moving `!Send` types (like `AuthManager`) into async closures. The workaround is spawning dedicated OS threads per operation. `Arc<Mutex<Option<T>>>` is simpler for single-value updates where the latest state matters more than a queue of events.

---

## Diagnostics & Error Architecture

- **`thiserror`**: Generates cleanly structured, typed domain errors inside internal operational and backend modules.
- **`tracing` & `tracing-subscriber`**: Provides structured, asynchronous contextual logging routed simultaneously to standard output and local rotating log files for post-crash diagnostics.
