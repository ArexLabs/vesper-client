# justfile — Vesper Client workspace recipes
# Run `just --list` to see all available recipes.

# Default recipe: run the full CI-quality check pipeline
default: all

# ─── Development ──────────────────────────────────────────────────────────────

# Build all workspace crates
build:
    cargo build

# Build all workspace crates in release mode
build-release:
    cargo build --release

# Fast compile-time check without producing binaries
check:
    cargo check

# Run the test suite
test:
    cargo test

# Run tests with stdout/stderr visible
test-verbose:
    cargo test -- --nocapture

# Run Clippy with all warnings treated as errors
clippy:
    cargo clippy -- -D warnings

# Format all code with rustfmt
fmt:
    cargo fmt

# Check formatting without modifying files
fmt-check:
    cargo fmt --check

# Remove build artifacts
clean:
    cargo clean

# ─── Run ──────────────────────────────────────────────────────────────────────

# Run the binary (vesper-client)
run:
    cargo run

# Run the binary in release mode
run-release:
    cargo run --release

# Run with debug-level logging
run-debug:
    RUST_LOG=debug cargo run

# ─── Quality ──────────────────────────────────────────────────────────────────

# Run clippy + formatting check (fast quality gate)
lint:
    cargo clippy -- -D warnings
    cargo fmt --check

# Full CI pipeline: check + clippy + fmt + tests
all: check clippy fmt-check test

# ─── Development Utilities ────────────────────────────────────────────────────

# Run with trace-level logging for all modules
log-trace:
    RUST_LOG=trace cargo run

# Run with trace-level logging for a specific module
# Usage: just log-module vesper_core::auth
log-module module:
    RUST_LOG={{module}}=trace cargo run

# Display the dependency tree
tree:
    cargo tree

# Show outdated dependencies (requires cargo-outdated)
outdated:
    cargo outdated

# Audit dependencies for known vulnerabilities (requires cargo-audit)
audit:
    cargo audit

# Update Cargo.lock to latest compatible versions
update:
    cargo update

# ─── Documentation ────────────────────────────────────────────────────────────

# Generate and open docs
doc:
    cargo doc --open

# Generate docs without dependencies and open
doc-no-deps:
    cargo doc --no-deps --open
