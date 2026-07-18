# Technology Stack - Vesper Client

This document outlines the complete technical stack, architectural boundaries, and crate dependencies utilized in the Vesper Client MVP. A modern, lightweight, isolated multi-version Minecraft launcher.

---

## Core Architecture Components

| Category             | Component / Crate | Purpose in Vesper Client                                                                                                 |
| -------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **User Interface**   | `slint`           | Hardware-accelerated native UI engine handling reactive views via a dedicated design DSL.                                |
| **Async Runtime**    | `tokio`           | Driving the non-blocking background thread pool, async I/O tasks, and network worker processes.                          |
| **Data Parallelism** | `rayon`           | Offloading CPU-bound workloads, specifically running parallel SHA-1 integrity checks for thousands of local asset files. |
| **Networking**       | `reqwest`         | Async HTTP client for fetching game manifests, API communication, and downloading assets.                                |

---

## Minecraft Domain Logic

- **`mc-launcher-core`**: The structural backbone for installing vanilla profiles, resolving Fabric/NeoForge dependencies, extracting native libraries, and building the final platform-compliant Java execution strings.
- **`minecraft-msa-auth`**: Simplifies the multi-step Microsoft OAuth authentication process (Microsoft Exchange -> Xbox Live -> XSTS -> Mojang token acquisition).

---

## Modding Ecosystem Integrations

- **`ferinth`**: Strongly-typed client wrapper providing native API interaction with the Modrinth ecosystem to search and fetch mods.
- **`furse`**: Client wrapper supplying programmatic access to the CurseForge API for legacy and exclusive mod distributions.
- **`futures-util`**: Used to implement concurrent download pipelines (`StreamExt`), allowing bounded parallel mod and asset downloads.

---

## Data, State & Serialization

- **`serde` & `serde_json**`: Compulsory frameworks for parsing dynamic, deeply nested JSON manifests from Mojang, Fabric, and NeoForge metadata endpoints.
- **`toml`**: Handles human-readable serialization and parsing for global settings (`vesper_config.toml`) and sandboxed instance configs (`instance.toml`).

---

## Filesystem & Hardware Awareness

- **`sha1`**: Computes local asset file hashes to verify data integrity against Mojang's metadata index, preventing redundant network use.
- **`zip`**: Unpacks native shared libraries (`.dll`, `.so`, `.dylib`) from core game jars and handles zipped modpack archives.
- **`directories`**: Provides cross-platform abstraction for standard OS storage paths, guaranteeing true instance sandboxing across Windows, macOS, and Linux.
- **`sysinfo`**: Queries runtime hardware memory capacity to dynamically compute safe Java allocation arguments (`-Xmx`).

---

## Diagnostics & Error Architecture

- **`thiserror`**: Generates cleanly structured, typed domain errors inside internal operational and backend modules.
- **`anyhow`**: High-level flexible error catcher used at the Slint UI callback boundaries to smoothly capture and display unexpected exceptions.
- **`tracing` & `tracing-subscriber**`: Provides structured, asynchronous contextual logging routed simultaneously to standard output and local rotating log files for post-crash diagnostics.
