# FIXES.md — Analysed Bugs & Fixes

## 1. Cargo.toml: `[lib]` crate-type missing `"lib"`

**Error:** `src/main.rs:4` — `vesper_client::run()` fails with "use of unresolved module or unlinked crate"
**Root cause:** The `[lib]` section specifies `crate-type = ["staticlib", "cdylib"]`, which overrides the default. Without `"lib"` in the list, the library crate isn't available for the binary to link against.
**Fix:** Add `"lib"` to the `crate-type` list.

## 2. keyring crate v3→v4 API breakage

**Errors in `src/secure_storage.rs`:**
- `E0425`: `keyring::Entry` not found (type removed from keyring v4 crate root)
- `E0433`: `keyring::Entry::new` not found
- `E0282` (×4): type annotations needed for error types

**Root cause:** keyring v4 is a complete rewrite. The `Entry` type moved to `keyring-core` v1. The `keyring` crate now only provides store initialization functions. Key differences:
- `keyring::Entry` → `keyring_core::Entry`
- `entry.delete_password()` → `entry.delete_credential()`
- A default credential store must be initialized before creating entries (via `keyring::use_native_store`)
- `keyring_core::Error::NoEntry` replaces fragile string matching

## 3. `src/commands/auth.rs:46` — Borrowed data escapes `tokio::spawn`

**Error:** `E0521` — `auth_url` (`&str`) escapes the function body inside `tokio::spawn(async move { ... })`, which requires `'static` lifetime.
**Fix:** Clone `auth_url` into a `String` before passing it into the spawned task.

## 4. Unused imports (warnings)

**`src/commands/auth.rs`:**
- `crate::error::AppError`
- `serde_json::json`
- `tauri::Manager` (inside function body)

**`src/commands/instance.rs`:**
- `crate::error::AppError`
- `std::path::PathBuf`

## 5. `src/services/mod_resolver.rs:26` — `reqwest::Error::new` is private

**Error:** `E0624` + `E0308` — `reqwest::Error::new` is `pub(crate)` (not publicly accessible), and arguments are wrong types (expected `Kind`, got `StatusCode`).
**Fix:** Use `response.error_for_status()` which returns a public `reqwest::Error` containing the status code. The `#[from]` attribute on `AppError::ModrinthApi` handles the conversion.
