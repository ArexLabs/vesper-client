# Task Context: GPUI Login Page Prototype

Session ID: 2026-08-20-gpui-prototype
Created: 2026-08-20T00:00:00Z
Status: in_progress

## Current Request
Migrate the Vesper Client UI from Slint to GPUI (Zed's GPU-accelerated framework).
Starting with a Login page prototype to validate the approach before full migration.

## Context Files (Standards to Follow)
- .opencode/context/core/standards/code-quality.md

## Reference Files (Source Material)
- vesper-client/src/main.rs (current Slint-based entry point)
- vesper-client/src/ui/app.slint (current Slint root)
- vesper-client/src/ui/login.slint (current Slint login page)
- vesper-client/src/ui/types.slint (Slint struct definitions)
- vesper-core/src/bridge/commands.rs (BackendCommand enum)
- vesper-core/src/bridge/updates.rs (UiUpdate enum)
- vesper-core/src/auth/flow.rs (AuthManager)
- vesper-core/Cargo.toml (vesper-core dependencies)

## Components
1. theme.rs — Catppuccin Mocha color tokens for GPUI
2. login_view.rs — Login page as a GPUI View entity
3. main.rs — GPUI Application lifecycle + MPSC bridge

## Constraints
- Backend (vesper-core) stays 100% unchanged
- MPSC bridge (BackendCommand/UiUpdate) must continue to work
- GPUI v0.2.2 from crates.io (pre-1.0, may have API limitations)
- Linux platform (user is on Linux)
- Must compile with `cargo check`

## Exit Criteria
- [ ] GPUI dependency added, Slint removed
- [ ] Login page renders with Catppuccin Mocha theme
- [ ] BackendCommand::AuthStartBrowserLogin works via GPUI button
- [ ] UiUpdate::AuthSuccess updates the GPUI view
- [ ] `cargo check` passes clean
